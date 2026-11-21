# architecture.md: Walled Guard

Single Electron app. Three process types plus a pure-logic scanner library.

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron + TypeScript (strict) | One install, Chromium for both sites, native dialogs, preload runs before page scripts |
| Build | electron-vite (or Vite + tsc) and electron-builder | Fast dev loop, one-click installers |
| Text/PDF | `pdfjs-dist` (legacy build, Node) | Page-level text extraction, early exit |
| OCR | `tesseract.js` with bundled `eng.traineddata` | Offline, runs in worker threads |
| Image prep | `sharp` (if installable) else `jimp` | Grayscale, downscale, invert |
| Storage | PostgreSQL (local) via `pg` plus **Drizzle ORM** and `drizzle-kit` migrations | Pure TS, no native binaries to package, type-safe, SQL-like API fits analytics queries |
| Dashboard UI | Vanilla TS or Preact plus Chart.js (bundled locally) | Small, CSP-friendly |
| Tests | Vitest (unit), Playwright-Electron (e2e) | |

## 2. High-level diagram

```
┌──────────────────────────── Electron app ────────────────────────────┐
│ MAIN PROCESS                                                          │
│  window/tabs · session · IPC router · dialog · scanner · store       │
│  network guard (webRequest) · response CSS injector                  │
│                                                                       │
│   ┌── Scanner (src/scanner, pure TS, worker pool) ──┐                │
│   │ sniff → extractor → matcher → verdict           │                │
│   └──────────────────────────────────────────────────┘                │
│   ┌── Store (PG/ORM) ──┐   ┌── Analytics service ──┐                 │
│   │ events table       │──▶│ aggregations, insights │                │
│   └────────────────────┘   └────────────────────────┘                │
│        ▲ IPC (typed, validated)             ▲ IPC                     │
├────────┼─────────────────────────────────────┼────────────────────────┤
│ PRELOAD (per web tab)                  RENDERER (dashboard/settings)  │
│  site adapter + gates                   charts, tables, settings      │
├────────┼───────────────────────────────────────────────────────────────┤
│ WEB TAB: chatgpt.com / perplexity.ai (unmodified pages)               │
└───────────────────────────────────────────────────────────────────────┘
```

Window layout: one `BaseWindow` with a tab bar (renderer view) and a content area holding one `WebContentsView` per tab: ChatGPT, Perplexity, Dashboard, Settings. Web tabs share a persistent partition `persist:walled-guard` so logins survive restarts.

## 3. Interception design (core of the assignment)

DOM events are synchronous. The dialog is asynchronous. So gates use **hold, scan, release**.

1. **Hold**: capture-phase listener on `window` (registered in preload before page scripts) calls `preventDefault()` and `stopImmediatePropagation()` on the triggering event.
2. **Scan**: `await bridge.scan(payload)` goes over IPC to main. Main scans and, if the marker is found, shows the native dialog. Main returns a `Decision`.
3. **Release**:
   - `allow` (clean or Continue): replay the action once with a one-shot bypass (`WeakSet` of events/elements) so the gate ignores the replay.
   - `block` (Cancel): do nothing. Text stays in the editor. For files, clear the input.

### Gate table

| Action | Hold on | Continue/clean replay | Cancel |
|---|---|---|---|
| Enter to send | `keydown` Enter, no Shift, not `isComposing` | click send button (bypass) | nothing |
| Send button | `click` on adapter's send selector | re-click (bypass) | nothing |
| File picker | `change` on `input[type=file]` | re-dispatch `change` (bypass) | `input.value = ''` |
| Drag and drop | `drop` | synthetic `drop` with same `DataTransfer` | discard |
| Paste | `paste` with `clipboardData.files` | re-dispatch | discard |

Prompt text is read from the adapter's `getPromptText()` (the editor is a contenteditable on ChatGPT, so use `innerText`). File bytes are read in the preload with `File.arrayBuffer()` and sent to main (size capped, transferred as a buffer).

### Network safety net (X5)
`session.webRequest.onBeforeRequest` for the two hosts. For conversation and upload POSTs, main checks a **decision cache** keyed by content hash. If a DOM gate already decided, the request passes. If no decision exists (a path the gates missed), scan the body, show the dialog and cancel or allow. The single-flight map prevents a double dialog.

### Single-flight and cache
- `inflight: Map<hash, Promise<Decision>>`: DOM and network layers asking about the same content share one dialog.
- `verdictCache: LRU<hash, ScanVerdict>` (TTL 5 min): caches only the **scan result**, never the user's decision. Retrying after Cancel therefore shows the dialog again (R4.3).

## 4. Scanner design (`src/scanner`, no Electron imports)

```
scan(input) ->
  sniff(bytes) -> 'text' | 'pdf' | 'image' | 'unsupported'
  text  : streamMatch(chunks)
  pdf   : for page in pages: textLayer -> match; if empty text -> render + OCR -> match; early exit on hit
  image : preprocess -> OCR -> match (normalised then fuzzy)
  -> ScanVerdict { found, source, location, ms }
```

### Matcher
- `normalize`: NFKC, strip zero-width chars (U+200B-U+200D, U+FEFF), case-fold.
- Exact: `indexOf` on normalised text. Multi-marker mode uses an Aho-Corasick automaton.
- Streaming: chunk reader keeps the last `len(marker)-1` characters across chunk boundaries (O(n) time, O(1) memory). Also search the marker as UTF-8, UTF-16LE and UTF-16BE byte patterns for text files.
- OCR-tolerant: strip all non-alphanumerics from OCR text and match `WALLEDSENSITIVE`. Fallback: Levenshtein distance <= 1 over a sliding window of marker length +/- 1 (or Bitap).
- PDFs: per-page early exit, metadata checked too, page-level OCR only if the text layer is empty or the page contains images.
- Images: downscale to about 2000 px, grayscale, run OCR. If inconclusive, run a second pass on the inverted image (dark-mode screenshots).

### Reliability
Worker pool (size = cores - 1, max 3) for OCR and PDF. Per-scan timeout (default 20 s) and size cap (50 MB). Timeout, error or unsupported leads to `scan_failed`, and with fail-closed on the dialog says "could not scan".

## 5. Response text colour
Main calls `webContents.insertCSS()` on `dom-ready` and `did-navigate-in-page`, using the CSS from the site adapter with `!important`. Because it is CSS, streamed nodes are covered with no `MutationObserver`. Re-insert on navigation (SPA) and when the colour setting changes (remove the old key via `removeInsertedCSS`). Exclude `pre, code, a` from the override or give them a readable colour (R5.4).

## 6. Site adapter pattern (`src/sites`)
```ts
interface SiteAdapter {
  id: 'chatgpt' | 'perplexity';
  hosts: string[];
  selectors: { editor: string[]; sendButton: string[]; fileInput: string[]; dropZone: string[]; assistantMessage: string[] };
  getPromptText(): string;
  responseCss(color: string): string;
}
```
Each selector entry is an ordered fallback list (prefer `data-testid`, `aria-label`, role, then structure). **Selectors must be verified against the live DOM before use**; keep them only in these files.

## 7. Dashboard and analytics

### Persistence layer (PostgreSQL + Drizzle ORM)

**Principle: the guard never depends on the database.** Scanning, the dialog and enforcement run with no DB. Logging is fire-and-forget through a repository interface.

```ts
// src/main/store/events-repo.ts
interface EventsRepo {
  insert(e: NewEvent): Promise<void>;
  list(q: EventQuery): Promise<Page<EventRow>>;
  aggregate: AnalyticsQueries;        // kpis, series, heatmap, breakdowns, repeatOffenders
  purgeOlderThan(ts: Date): Promise<number>;
  clear(): Promise<void>;
  health(): Promise<'up' | 'down'>;
}
```
Implementations:
- `PgEventsRepo` (Drizzle plus `pg.Pool`), the primary.
- `MemoryEventsRepo`, used automatically when Postgres is unreachable or `DATABASE_URL` is unset. The dashboard shows a "Database not connected, showing this session only" banner. This keeps the app runnable for reviewers who have no Postgres.
- A write-behind queue (bounded, in-memory) retries inserts with backoff, so a DB outage never blocks or delays a prompt/file decision.

Settings (marker list, colour, toggles) are stored in a JSON file in Electron `userData`, not in Postgres, so the guard works with no DB.

### Schema (Drizzle, `src/main/store/schema.ts`)
```ts
import { pgTable, bigserial, timestamp, text, integer, boolean, index } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  site: text('site', { enum: ['chatgpt', 'perplexity'] }).notNull(),
  kind: text('kind', { enum: ['prompt', 'file'] }).notNull(),
  fileType: text('file_type', { enum: ['text', 'pdf', 'image'] }),
  fileName: text('file_name'),
  sizeBytes: integer('size_bytes'),
  detected: boolean('detected').notNull(),
  detectionSource: text('detection_source', { enum: ['plain-text', 'text-layer', 'ocr', 'fuzzy'] }),
  decision: text('decision', { enum: ['clean', 'continued', 'cancelled', 'scan_failed'] }).notNull(),
  scanMs: integer('scan_ms'),
  contentHash: text('content_hash').notNull(),
  snippet: text('snippet'), // opt-in, <= 80 chars
}, (t) => ({
  tsIdx: index('idx_events_ts').on(t.ts),
  hashIdx: index('idx_events_hash').on(t.contentHash),
  siteKindIdx: index('idx_events_site_kind').on(t.site, t.kind),
}));
```

### Configuration and migrations
- `DATABASE_URL` is read from `.env` (git-ignored). Commit `.env.example` only, never real credentials.
- `drizzle.config.ts` plus `drizzle-kit generate` produce SQL migrations in `/drizzle`. The app runs `migrate()` on startup when the DB is reachable.
- `docker-compose.yml` provides a one-command local Postgres (`docker compose up -d`) for reviewers. The README also documents a native Postgres setup.
- `pg.Pool` lives only in the main process. The renderer reaches data only through the read-only analytics IPC.
- Query dialect notes: time buckets use `date_trunc('hour'|'day', ts)`, the heatmap uses `EXTRACT(DOW FROM ts)` and `EXTRACT(HOUR FROM ts)`, and repeat offenders use `GROUP BY content_hash HAVING COUNT(*) > 1`. Use Drizzle's `sql` template for these aggregates.
- Convert `bigint` and `count` results to numbers explicitly, since `pg` returns strings for them.

### Analytics service (pure functions over query results)
- `kpis(range)`: counts, leak rate = detected / total, override rate = continued / detected.
- `timeSeries(range, bucket)`: `GROUP BY date_trunc(bucket, ts)`.
- `heatmap(range)`: weekday x hour counts for detected events.
- `breakdowns(range)`: by site, file_type, decision, detection_source.
- `repeatOffenders(range)`: `GROUP BY content_hash HAVING COUNT(*) > 1 AND detected = 1`.
- `insights(range)`: rule-based generator (top site, override rate threshold, peak hour, trend delta vs previous equal period).

### Risk score (0-100, transparent)
```
risk = 100 * clamp( 0.40 * leakRate*5
                  + 0.35 * overrideRate
                  + 0.15 * min(repeatCount/5, 1)
                  + 0.10 * fileShareOfDetections )
```
`leakRate*5` is clamped to 1 (a 20 percent leak rate saturates it). The formula is shown in the dashboard tooltip. Bands: 0-29 Low, 30-59 Medium, 60-100 High.

### Dashboard IPC (read-only)
`analytics:kpis`, `analytics:series`, `analytics:heatmap`, `analytics:breakdowns`, `analytics:insights`, `events:list`, `events:export`, `events:clear`, `settings:get|set`. The renderer never touches the DB directly.

## 8. IPC contract (`src/shared/types.ts`)
```ts
type ScanRequest  = { site: SiteId; kind: 'prompt'|'file'; name?: string; mime?: string; data: string | ArrayBuffer };
type ScanVerdict  = { found: boolean; source?: DetectionSource; location?: string; failed?: boolean; ms: number };
type Decision     = { action: 'allow'|'block'; reason: 'clean'|'continued'|'cancelled'|'scan_failed' };
```
Channels: `guard:scan` (invoke, returns `Decision`). Main logs the event after the decision. All payloads validated with a schema (zod or manual guards) and size-capped.

## 9. Native dialog (`src/main/dialog/confirm-dialog.ts`)
`dialog.showMessageBox(parentWindow, { type: 'warning', title: 'Sensitive content detected', message, detail, buttons: ['Continue', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true })`
- message: `Sensitive marker found in a text prompt` or `... in a file (PDF)`
- detail: `Name: report.pdf` or the truncated prompt snippet, plus the scan source (`found on page 3 via OCR`).

## 10. Directory structure
```
walled-guard/
├─ package.json  tsconfig.json  electron.vite.config.ts  electron-builder.yml
├─ drizzle.config.ts  docker-compose.yml  .env.example  drizzle/  (generated migrations)
├─ .eslintrc.cjs  .prettierrc  .gitignore  vitest.config.ts
├─ README.md
├─ requirement.md  plan.md  architecture.md  master-prompt.md
├─ docs/  architecture-public.md  test-matrix.md  demo-script.md  selectors-log.md
├─ src/
│  ├─ shared/        constants.ts  types.ts  ipc-channels.ts  schema.ts  logger.ts
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ window/     main-window.ts  tabs.ts  session.ts
│  │  ├─ ipc/        guard-handler.ts  analytics-handler.ts  settings-handler.ts
│  │  ├─ dialog/     confirm-dialog.ts
│  │  ├─ network/    upload-guard.ts
│  │  ├─ styling/    response-style.ts
│  │  ├─ store/      db.ts  schema.ts  events-repo.ts  pg-events-repo.ts  memory-events-repo.ts  write-queue.ts  migrate.ts  settings-store.ts
│  │  └─ analytics/  kpis.ts  series.ts  insights.ts  risk-score.ts
│  ├─ scanner/       index.ts  sniff.ts  cache.ts  single-flight.ts
│  │  ├─ extractors/ text.ts  pdf.ts  image.ts
│  │  ├─ matcher/    normalize.ts  streaming.ts  fuzzy.ts  aho-corasick.ts
│  │  └─ workers/    ocr.worker.ts  pdf.worker.ts  pool.ts
│  ├─ preload/       web.ts  dashboard.ts  bridge.ts
│  │  └─ gates/      prompt-gate.ts  file-gate.ts  gate-state.ts  index.ts
│  ├─ sites/         types.ts  chatgpt.ts  perplexity.ts  registry.ts
│  └─ renderer/
│     ├─ shell/      index.html  tabs.ts
│     ├─ dashboard/  index.html  main.ts  charts.ts  widgets/  styles.css
│     └─ settings/   index.html  main.ts
├─ resources/        tessdata/eng.traineddata  icons/
├─ tests/            unit/  e2e/  fixtures/
└─ scripts/          make-fixtures.ts  seed-demo-data.ts
```

## 11. Security configuration summary
- Web tabs: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, preload exposes only `bridge.scan`.
- Dashboard/settings renderer: separate preload, read-only analytics API, strict CSP (`default-src 'self'`).
- `setWindowOpenHandler` and `will-navigate` restrict web tabs to the two allowed hosts (allow auth redirect hosts as needed, e.g. auth.openai.com, accounts.google.com if testing, but verify). External links open in the system browser.
- Block permission requests that are not needed.

## 12. Design decisions and trade-offs
- **Electron over extension**: single install, direct IPC to a native dialog, no localhost server.
- **Cache verdicts, never decisions**: keeps "Cancel then retry" behaviour correct.
- **Fail closed**: an unscannable file prompts the user rather than silently leaking.
- **Hash-only logging**: analytics without storing sensitive content.
- **Adapter pattern**: all site-fragile code lives in `src/sites`.
