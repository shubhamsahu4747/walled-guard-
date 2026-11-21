# plan.md: Walled Guard execution plan

Deadline: Mon 23 Nov 2026, EOD IST. Read `requirement.md` and `architecture.md` first.
Rule: finish all [MUST] items (Phases 0-5, 7) before any [SHOULD] item. Phase 6 (dashboard) is the differentiator but never blocks the MUST path.

Legend: [ ] todo. Each task lists its Done-when check.

---

## Phase 0: Risk smoke test (first 45 min, do before writing real code)
- [x] 0.1 Scaffold a minimal Electron app opening chatgpt.com and perplexity.ai in two `WebContentsView`s with a persistent partition.
  Done when: both pages load, login with email works, session survives restart.
- [x] 0.2 Record findings in `docs/selectors-log.md`: any bot/Cloudflare challenge, SSO block, the working user-agent setting.
- [x] 0.3 With DevTools, record the CURRENT live selectors for: prompt editor, send button, file input, drop zone, assistant message container on both sites. Never invent selectors.
  Done when: selectors-log.md has a verified list with the date checked.
- [x] **Decision gate**: if a site blocks embedded Chromium entirely, stop and report to the user before continuing. Passed: both sites load without challenge.

## Phase 1: Project foundation
- [ ] 1.1 Initialise repo with the structure in architecture.md section 10 (empty files with TODO headers are fine).
- [ ] 1.2 Configure TypeScript strict, ESLint, Prettier, Vitest, electron-vite, electron-builder.
- [ ] 1.3 `src/shared`: constants (MARKER, limits), types, IPC channel names, payload validators, logger.
  Done when: `npm run dev` opens the shell, `npm run lint` and `npm run typecheck` pass.

## Phase 2: Scanner core (pure logic, fully unit-tested)
- [ ] 2.1 `normalize.ts` plus tests (case, NFKC, zero-width).
- [ ] 2.2 `streaming.ts` chunked matcher with overlap. Test: marker split across chunk boundaries, UTF-16 files.
- [ ] 2.3 `sniff.ts` magic-byte detection (PDF `%PDF`, PNG, JPEG, WebP, GIF, text heuristic).
- [ ] 2.4 `extractors/text.ts` and `extractors/pdf.ts` (text layer, per-page early exit, metadata).
- [ ] 2.5 `extractors/image.ts` plus OCR worker and pool (downscale, grayscale, inverted second pass).
- [ ] 2.6 `fuzzy.ts` OCR-tolerant matching (stripped match, then Levenshtein <= 1).
- [ ] 2.7 `scanner/index.ts` orchestrator, verdict cache (LRU, TTL, hash key), single-flight, timeout, size cap, fail-closed `scan_failed`.
- [ ] 2.8 `scripts/make-fixtures.ts`: generate clean and marked txt, text-layer pdf, scanned pdf, png, dark-mode png.
  Done when: `npm test` passes the full matrix: every fixture returns the correct verdict, and a clean prompt scans in under 50 ms.

## Phase 3: Native dialog and decision engine
- [ ] 3.1 `confirm-dialog.ts` per architecture section 9 (Continue/Cancel, Cancel default, Esc cancels).
- [ ] 3.2 `guard-handler.ts`: validates payload, scans, shows the dialog only if found or failed, returns `Decision`, logs the event.
- [ ] 3.3 Dev-only debug command to trigger the dialog with fake input.
  Done when: the dialog shows the correct type (prompt/file), name or snippet, and both buttons return the right decision.

## Phase 4: In-page gates (web integration)
- [ ] 4.1 `sites/` adapters for ChatGPT and Perplexity using ONLY the selectors verified in Phase 0.
- [ ] 4.2 `preload/gates/gate-state.ts` state machine (IDLE, HELD, AWAITING, RELEASED/BLOCKED) and the bypass WeakSet.
- [ ] 4.3 `prompt-gate.ts`: Enter and send-button, IME-safe, Shift+Enter allowed.
- [ ] 4.4 `file-gate.ts`: picker, drop, paste. Replay on allow, clear input on cancel.
- [ ] 4.5 Wire preload to main via the typed bridge. Pick the adapter by hostname.
  Done when: acceptance A1-A7 and A10 pass manually on ChatGPT first, then Perplexity.

## Phase 5: Response colour
- [ ] 5.1 `response-style.ts`: insertCSS on dom-ready, `did-navigate-in-page`, `did-finish-load`. Manage the inserted CSS key.
- [ ] 5.2 Per-site `responseCss(color)` with `!important`, readable code and link handling.
  Done when: A8 and A9 pass including streamed and history responses, and the colour survives SPA navigation.

## Phase 6: Dashboard and analytics [SHOULD]
- [ ] 6.1 Store: PostgreSQL via Drizzle ORM. Define `schema.ts`, `drizzle.config.ts`, generate migrations and run them on startup. Implement the `EventsRepo` interface with `PgEventsRepo` and `MemoryEventsRepo` (auto-fallback when the DB is down or `DATABASE_URL` is unset), a bounded write-behind queue with retry, retention purge, and `docker-compose.yml` plus `.env.example`.
  Done when: events persist across restarts with Postgres up. With Postgres stopped, the guard and dialog still work and the dashboard shows the "not connected" banner.
- [ ] 6.2 Hook the guard handler to log every inspected action (clean ones too), hash only.
- [ ] 6.3 Analytics service: kpis, timeSeries, heatmap, breakdowns, repeatOffenders, risk-score, insights. Unit tests with seeded data.
- [ ] 6.4 Analytics IPC handlers (read-only), dashboard preload and schema validation.
- [ ] 6.5 Dashboard UI: KPI cards, time series, site and file-type breakdowns, decision donut, heatmap, events table with filters and range selector, risk gauge, insights panel. Chart.js bundled locally and CSP strict.
- [ ] 6.6 Data controls: CSV/JSON export, clear data with confirmation, retention setting.
- [ ] 6.7 `scripts/seed-demo-data.ts` to generate about 300 realistic events so the demo dashboard looks populated.
  Done when: the dashboard updates live after a real detection and all widgets render with seeded data.

## Phase 7: Network safety net and hardening
- [ ] 7.1 `upload-guard.ts` with decision cache plus single-flight (no double dialogs). [SHOULD]
- [ ] 7.2 Navigation restrictions, `setWindowOpenHandler`, permission handler, CSP, sandbox verification.
- [ ] 7.3 Settings tab: marker list, colour picker, fail-closed toggle, snippet-logging toggle, retention. [SHOULD]
- [ ] 7.4 Error handling pass: scan crash, worker failure, huge file, empty file, password-protected PDF, corrupted image.
  Done when: no unhandled rejections, a failure results in the fail-closed dialog and not a silent pass.

## Phase 8: QA
- [ ] 8.1 Execute the full test matrix in `docs/test-matrix.md` on BOTH sites (A1-A10 plus edge cases: Shift+Enter, IME, multi-file select, large file, same file re-upload after cancel, marker in a different case, marker split across lines).
- [ ] 8.2 Playwright-Electron smoke tests for what can be automated (dialog stubbed).
- [ ] 8.3 Fix regressions. Re-verify selectors the day of recording.

## Phase 9: Packaging and docs
- [ ] 9.1 electron-builder config, build an installer for the host OS, test a clean install.
- [ ] 9.2 README: prerequisites, install, run, build, usage, how to log in, troubleshooting, limitations.
- [ ] 9.3 `docs/architecture-public.md` (adapted from architecture.md, with diagram and interception flow).
- [ ] 9.4 `docs/demo-script.md` and the recorded demo (below).

## Phase 10: Demo and submission
Demo script (about 5-7 min, public link, no sign-in):
1. 20 s intro: what the app is, single install.
2. ChatGPT: clean prompt, marked prompt (Cancel then retry, then Continue), marked txt, PDF, image, response colour.
3. Perplexity: same sequence.
4. Dashboard: seeded plus live events, insights, risk score, export.
5. 30 s architecture recap.
- [ ] 10.1 Upload the video (YouTube unlisted or a public Drive link). Verify it opens in an incognito window.
- [ ] 10.2 Make the GitHub repo public. Verify in incognito.
- [ ] 10.3 Submit CV, repo link and video link via the form before EOD Mon 23 Nov IST.

---

## Suggested schedule (IST)
| When | Goal |
|---|---|
| Sat 21 Nov | Phases 0-3 (smoke test, foundation, scanner, dialog) |
| Sun 22 Nov | Phases 4-6 and 7.1/7.2 (gates, colour, dashboard) |
| Mon 23 Nov AM | Phases 7.3-9 (hardening, QA, packaging, docs) |
| Mon 23 Nov PM | Phase 10 (record, upload, submit) with buffer. Submit before evening. |

## Definition of Done
1. All A1-A10 pass on both sites.
2. Clean builds with lint, typecheck and tests green.
3. No content modification, no unintended interference with the sites.
4. README and architecture docs complete. The demo is public.
5. Dashboard works with live and seeded data.

## Cut list if time runs short (drop in this order)
X6, X2, X4, heatmap, trend comparison, tray icon, Settings tab, network safety net. Never cut: Phases 0-5 and 8-10.
