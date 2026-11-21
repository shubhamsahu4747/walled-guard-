# requirement.md: Walled Guard (Sensitive Upload Guard)

Source: Walled AI Candidate Assignment (Screening-2). Deadline: Mon 23 Nov 2026, EOD IST.
This file is the single source of truth for WHAT to build. Priority tags: **[MUST]** = graded assignment requirement, **[SHOULD]** = bonus feature, **[COULD]** = only if time remains.

---

## 1. Product summary

A single-install desktop application (Electron + TypeScript) that hosts ChatGPT (https://chatgpt.com) and Perplexity (https://www.perplexity.ai) in tabs, acts as a lightweight DLP layer, and shows a local analytics dashboard about AI usage and sensitive-data events.

No browser extension. No separate background service. One installer.

## 2. Core requirements (assignment) [MUST]

### R1. Prompt inspection
- R1.1 Intercept text prompts BEFORE submission on both sites (Enter key and send button).
- R1.2 Scan prompt text for marker `WALLED_SENSITIVE`.
- R1.3 No marker: submit immediately, no dialog, no perceptible delay.

### R2. File inspection
- R2.1 Intercept file uploads BEFORE transmission on both sites: file picker, drag-and-drop, paste.
- R2.2 Supported formats: **text**, **PDF**, **image**.
- R2.3 Text files: scan content. PDFs: scan text layer, OCR pages that have no text layer. Images: OCR.
- R2.4 Detect type by magic bytes, not extension.
- R2.5 Unsupported or unreadable files: treat as "could not scan" (see R4.4).

### R3. Native confirmation dialog
- R3.1 Shown whenever the marker is detected. Must be a **native desktop dialog** (Electron `dialog.showMessageBox`), not HTML.
- R3.2 Must state whether the hit was in a **text prompt** or a **file**.
- R3.3 Must show the **prompt snippet** (truncated) or the **file name**.
- R3.4 Exactly two labelled actions: **Continue** and **Cancel**. Cancel is the default button and Esc triggers Cancel.

### R4. Enforcement
- R4.1 Continue: the original action proceeds normally. Content is NOT modified. Site functionality is not disturbed.
- R4.2 Cancel: the action is blocked. Prompt text remains in the editor so the user can edit, retry or resubmit. A cancelled file is removed from the input so it can be re-selected.
- R4.3 A retry of the same content after Cancel must show the dialog again (decision is not remembered as "allow").
- R4.4 Scan failure/timeout: fail closed. Show the same dialog with reason "could not scan" so the user decides.

### R5. Response text colour
- R5.1 Change the text colour of ALL AI-generated responses on ChatGPT and Perplexity.
- R5.2 Must apply to streamed content and to responses loaded from history.
- R5.3 Colour is configurable through one variable (default a clearly visible colour such as `#00A86B`), applied consistently across both sites.
- R5.4 Must not break readability of code blocks, links or tables.

### R6. General
- R6.1 Works reliably on both sites, with a persistent login session.
- R6.2 Sensitive content is inspected BEFORE it leaves the machine.
- R6.3 Does not interfere with normal browsing or site features.
- R6.4 Modular, readable, maintainable code.

### Acceptance criteria (must all pass on BOTH sites)

| # | Scenario | Expected |
|---|---|---|
| A1 | Prompt without marker | Sent, no dialog |
| A2 | Prompt with marker | Native dialog |
| A3 | .txt with marker | Native dialog before upload |
| A4 | PDF with marker (text layer) | Native dialog before upload |
| A4b | PDF with marker (scanned) | Native dialog before upload |
| A5 | Image with marker | Native dialog before upload |
| A6 | Continue | Original action proceeds, content unchanged |
| A7 | Cancel | Action blocked, content stays editable/retryable |
| A8 | ChatGPT response | Text colour changed |
| A9 | Perplexity response | Text colour changed |
| A10 | Clean file | Uploaded without dialog |

## 3. Feature requirements: Dashboard and Analytics [SHOULD]

Built into the same app as a third tab ("Dashboard"). Fully local. No data leaves the machine.

### F1. Event logging
Every inspected action creates an event record:

| Field | Notes |
|---|---|
| id, timestamp | |
| site | `chatgpt` / `perplexity` |
| kind | `prompt` / `file` |
| fileType | `text` / `pdf` / `image` / null |
| fileName | for files only |
| sizeBytes | |
| detected | boolean |
| detectionSource | `text-layer` / `ocr` / `plain-text` / `fuzzy` / null |
| decision | `clean` / `continued` / `cancelled` / `scan_failed` |
| scanMs | scan duration |
| contentHash | SHA-256 of content |
| snippet | OPTIONAL, off by default (see privacy) |

### F2. Dashboard widgets
1. KPI cards: total prompts, total file uploads, sensitive detections, leak rate (%), blocked count, overridden count.
2. Time series: activity per day/hour split by clean vs sensitive.
3. Breakdown by site (ChatGPT vs Perplexity).
4. Breakdown by file type (text / PDF / image).
5. Decision split: Cancelled vs Continued (donut).
6. Activity heatmap (weekday x hour).
7. Recent events table with filters (site, kind, decision, date range) and search.
8. Date range selector (Today / 7d / 30d / All).

### F3. Sensitive-information usage analytics
1. **Override rate**: share of detections where the user clicked Continue.
2. **Risk score (0-100)**: transparent formula (documented in architecture.md) combining detection rate, override rate, repeat offenders, file-vs-prompt mix.
3. **Repeat leak detection**: same `contentHash` flagged multiple times.
4. **Insights panel**: auto-generated plain-language insights, e.g. "Most sensitive events happen on Perplexity", "70% of detections were overridden", "Peak risk hour: 15:00".
5. **Trend comparison**: this period vs previous period.
6. **Detection source breakdown**: how many hits came from OCR vs text layer.

### F4. Data controls [SHOULD]
- Export events as CSV / JSON.
- Clear all data (with confirmation).
- Retention setting (30 / 90 / 365 days / forever), auto-purge on startup.

## 4. Additional features [SHOULD / COULD]

| ID | Feature | Priority |
|---|---|---|
| X1 | Settings tab: marker list, response colour picker, fail-closed toggle, snippet logging toggle, retention | SHOULD |
| X2 | Tray icon with a counter of today's detections | COULD |
| X3 | Dialog "details" text with scan source (e.g. "found on PDF page 3 via OCR") | SHOULD |
| X4 | Multiple markers (configurable), matcher already supports Aho-Corasick | COULD |
| X5 | Network-level safety net (`webRequest`) for uploads the DOM gates miss | SHOULD |
| X6 | Weekly summary report (HTML export) | COULD |

Do not let X-features delay any [MUST] item.

## 5. Privacy and security requirements
- P1. Never store full prompt text or file contents. Store hash plus metadata. Snippet logging is opt-in and truncated to 80 chars.
- P2. The scan decision happens in the main process. The renderer/preload cannot approve a send by itself.
- P3. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for web tabs. Preload exposes only a typed, minimal bridge.
- P4. The dashboard renderer must not be navigable to external URLs. CSP set to local resources only. Charts library bundled locally.
- P5. No telemetry, no outbound requests other than to the two sites.
- P6. Validate every IPC payload (type, size cap).

## 6. Non-functional requirements
- N1. Clean prompt overhead < 50 ms. Text file < 5 MB scan < 500 ms. Image OCR < 5 s typical. PDF per page early exit.
- N2. Max file size for scanning 50 MB (configurable). Above cap: scan_failed path.
- N3. Works offline for scanning (OCR language data bundled).
- N4. Platforms: Windows (primary), macOS, Linux builds via electron-builder.
- N5. Unit test coverage on scanner and matcher; E2E smoke on both sites.
- N6. TypeScript strict mode, ESLint and Prettier clean.

## 7. Submission deliverables
1. Public GitHub repo with full source.
2. README (setup, run, use, build installer).
3. docs/architecture.md (interception and enforcement explained).
4. Public demo video (no sign-in needed), covering the full acceptance table on BOTH sites plus a short dashboard tour.
5. CV and form submission.

## 8. Out of scope
Other AI sites, server/cloud components, user accounts, ML-based classification, enterprise policy management.

## 9. Known risks (verify early)
1. Google/SSO login can be blocked in embedded browsers. Use email login and a persistent partition.
2. Cloudflare challenges on embedded Chromium. Test both sites first.
3. Site DOM selectors change often. They are isolated in `src/sites/*` and must be verified live, never assumed.
4. Storage is local PostgreSQL via Drizzle ORM. Postgres must be running for persistent analytics, but the guard must never depend on it. When the DB is unreachable the app falls back to an in-memory repo (dashboard shows a banner), and the guard keeps working. Credentials live only in a git-ignored `.env`; commit `.env.example` and a `docker-compose.yml` for reviewers.
