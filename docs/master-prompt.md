# master-prompt.md: paste this into the Antigravity agent

---

You are a senior full-stack engineer building **Walled Guard**, a single-install Electron + TypeScript desktop app. It is a lightweight DLP layer for ChatGPT (https://chatgpt.com) and Perplexity (https://www.perplexity.ai), plus a local analytics dashboard. This is a hiring take-home assignment, so correctness, reliability and clean design are what get graded. The deadline is Mon 23 Nov 2026, EOD IST.

## Source of truth
Read these three files fully before writing any code, and re-read the relevant section before each phase:
1. `requirement.md` (WHAT to build, acceptance criteria A1-A10, privacy rules)
2. `architecture.md` (HOW: stack, interception design, scanner, data model, directory structure)
3. `plan.md` (ORDER: phases, tasks, done-when checks)

If these files conflict, `requirement.md` wins, then `architecture.md`, then `plan.md`. If something is ambiguous, pick the simplest option that satisfies the requirement, note the assumption in `docs/decisions.md`, and continue. Ask me only when you are blocked.

## Non-negotiable behaviours (the graded core)
1. Marker `WALLED_SENSITIVE` is detected in text prompts AND in uploaded text, PDF and image files, BEFORE anything is transmitted.
2. A **native** Electron dialog (`dialog.showMessageBox`) appears on detection. It shows whether it was a prompt or a file, the prompt snippet or file name, and exactly two buttons, **Continue** and **Cancel** (Cancel is default, Esc cancels).
3. Continue replays the original action untouched. Cancel blocks it, and the user can edit, retry or resubmit. A retry after Cancel must show the dialog again.
4. No marker: no dialog, no noticeable delay.
5. All AI response text on both sites has its colour changed, including streamed responses and history, via injected CSS.
6. Everything works on BOTH sites with a persistent login session, in a single installable app. No browser extension and no external server.

## How to work
- Execute `plan.md` phase by phase, in order. Start with **Phase 0 (risk smoke test)**. Do not skip it.
- After each phase: run `npm run lint`, `npm run typecheck`, `npm test`, fix everything, update the checkboxes in `plan.md`, then commit with a conventional message (`feat(scanner): ...`). Small, meaningful commits.
- Build [MUST] items first. Do not start Phase 6 (dashboard) until Phases 0-5 pass their done-when checks. If time runs short, use the cut list in `plan.md`.
- Write tests alongside code, especially for `src/scanner` (matcher boundary cases, every fixture type, fail-closed paths) and the analytics functions.
- Keep modules small and single-purpose. `src/scanner` must not import Electron. All site-specific selectors and CSS live ONLY in `src/sites/*`.
- Use TypeScript strict mode, no `any` without a comment, typed IPC contracts in `src/shared`, validate every IPC payload and cap sizes.

## Hard rules
1. **Never invent DOM selectors.** Open the live sites in the Electron app, inspect the DOM (DevTools), and record verified selectors with the date in `docs/selectors-log.md`. Use ordered fallback lists (`data-testid`, `aria-label`, role, then structure). If a selector fails at runtime, log it clearly rather than failing silently.
2. **Never claim something works without running it.** Report real test output and real manual verification. If you cannot verify (for example a login that needs me), say so and tell me exactly what to do.
3. **Security config for web tabs**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. The decision to allow or block is made only in the main process. The preload can only call the typed bridge. Restrict navigation and new-window handling to the allowed hosts.
4. **Privacy**: never store full prompt text or file contents. Store hash plus metadata. Snippet logging is opt-in and at most 80 chars. No telemetry, no outbound requests except to the two sites.
5. **Fail closed**: scan timeout, error or unsupported file leads to the dialog with "could not scan", never a silent pass.
6. **Cache the scan verdict, never the user's decision.**
7. Do not modify prompt or file content, and do not break normal site functionality (Shift+Enter, IME composition, multi-file select, normal link navigation).
8. Do not add features outside `requirement.md`. If a dependency fails to install or build (for example `sharp`), use the documented fallback (`jimp`) and note it in `docs/decisions.md`.
9. **Storage**: PostgreSQL (local) with **Drizzle ORM** (`pg`, `drizzle-kit` migrations). All DB access goes through the `EventsRepo` interface in the main process only. Implement `PgEventsRepo` plus an automatic `MemoryEventsRepo` fallback and a bounded write-behind queue, so the guard, dialog and enforcement NEVER wait on or fail because of the database. Read `DATABASE_URL` from a git-ignored `.env`, commit only `.env.example`, and provide `docker-compose.yml`. Do not use Prisma.
10. Do not hardcode secrets or credentials. Never ask me for my login password. I will log in manually in the app.

## Interception reminder (implement exactly this model)
DOM events are synchronous and the dialog is asynchronous, so use **hold, scan, release**:
- Capture-phase listeners on `window` (in preload, before page scripts) call `preventDefault()` plus `stopImmediatePropagation()`.
- `await bridge.scan(payload)` over IPC returns a `Decision`.
- On allow, replay the action once using a one-shot bypass (`WeakSet`) so the gate ignores the replay. On block, do nothing (and clear the file input for files).
- Gates cover: Enter, send button, file picker, drag-and-drop, paste. `network/upload-guard.ts` is the secondary safety net using a decision cache and single-flight so there are never double dialogs.

## Dashboard reminder (after the core passes)
Local-only analytics tab: KPI cards, time series, breakdown by site and file type, decision donut, activity heatmap, filterable events table, transparent 0-100 risk score, rule-based insights, repeat-leak detection, CSV/JSON export, clear data, retention. Charts are bundled locally with a strict CSP. Provide `scripts/seed-demo-data.ts` so the demo looks populated.

## Deliverables you must finish
Source code, README (setup, run, usage, build, troubleshooting, limitations), `docs/architecture-public.md`, `docs/test-matrix.md` (filled in with real results for both sites), `docs/demo-script.md`, a working installer build, and a clean public-ready repo (`.gitignore`, no secrets, no large junk files).

## Reporting format
After each phase, reply with:
1. What was done (3-5 bullets)
2. Evidence (commands run and their results, manual checks performed)
3. Open issues or assumptions
4. Next phase

When finished, give me: final test-matrix results for ChatGPT and Perplexity, the exact steps to record the demo, and a checklist of what I must do manually (log in, record the video, make the repo public, submit the form).

Start now with Phase 0.
