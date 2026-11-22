# Walled Guard

> **A single-install, enterprise-grade Data Loss Prevention (DLP) standalone desktop application for ChatGPT and Perplexity, coupled with local security intelligence.**

[![Test Suite](https://img.shields.io/badge/tests-62%20passed-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict%205.7-blue.svg)]()
[![Electron](https://img.shields.io/badge/electron-45.4.1-cyan.svg)]()
[![Architecture](https://img.shields.io/badge/architecture-100%25%20Standalone%20Desktop-purple.svg)]()
[![Zero Extensions](https://img.shields.io/badge/browser%20extensions-none%20(standalone)-success.svg)]()
[![PostgreSQL](https://img.shields.io/badge/storage-Postgres%20%2B%20Memory%20Fallback-indigo.svg)]()
[![License](https://img.shields.io/badge/license-ISC-green.svg)]()

---

> [!IMPORTANT]
> ### 🛡️ Standalone Desktop Architecture Notice (Candidate Screening Requirement)
> **Walled Guard is 100% a standalone desktop application.**
> - **Zero Browser Extensions or Plugins:** Does **not** require, bundle, or use any Chrome, Edge, Firefox, or Safari browser extension or add-on.
> - **No Background System Daemons / MITM Proxies:** Does not require external background services, local proxy daemons, or root CA certificate installations.
> - **Self-Contained Embedded Workspace:** Hosts `chatgpt.com` and `perplexity.ai` directly inside native Electron `WebContentsView` instances with isolated session partitioning (`persist:walled-guard`).
> - **100% Local-First DLP Engine:** All prompt interception, PDF text-layer analysis, offline Tesseract OCR scanning, and SHA-256 tamper-evident audit logging execute strictly on the client desktop.

---

## Overview

**Walled Guard** intercepts confidential and sensitive markers (default: `WALLED_SENSITIVE`) before prompts, text files, PDFs, or images can leave the user's computer to AI endpoints.

Built strictly according to candidate screening requirements:
- **100% Standalone Desktop Application** (Electron 45 + strict TypeScript 5.7).
- **No browser extension or plugin** (no Chrome/Edge/Firefox add-ons).
- **No separate background service or daemon**.
- **One single installer** (`Walled Guard-Setup-1.0.0.exe`).
- **Pure functional architecture** — zero ES6 class hierarchies.

---

## Key Capabilities

| Requirement | Implementation | Status |
| :--- | :--- | :---: |
| **A1: Clean Prompt Submission** | Evaluates clean prompts in $< 50\text{ ms}$; transmits immediately with zero dialog. | Verified |
| **A2: Sensitive Prompt Detection & Cancel** | Captures `WALLED_SENSITIVE` on Enter or Send click; triggers native OS dialog. Clicking **Cancel** or pressing `Esc` leaves prompt editable in place with zero network egress. | Verified |
| **A3: Retry After Cancel** | Replaying action re-triggers dialog (verdicts cached, user decisions never cached). Clicking **Continue** submits prompt untouched. | Verified |
| **A4: PDF Text-Layer DLP** | Page-by-page streaming extraction via `pdfjs-dist` with early exit upon first marker detection. | Verified |
| **A5: Image & Scanned OCR DLP** | Offline Tesseract OCR with bundled language pack (`eng.traineddata`), grayscale contrast boost, and fuzzy Levenshtein matching. | Verified |
| **A6: Perplexity Parity** | Identical DOM gate interception and native dialog behavior on both `chatgpt.com` and `perplexity.ai`. | Verified |
| **A7: Response Recoloring** | Recolors assistant responses to **Spring Green** (`#00A86B`) via streaming MutationObserver while preserving code blocks, syntax tokens, links, and tables (`revert !important`). | Verified |
| **A8: Storage & In-Memory Fallback** | Local PostgreSQL with Drizzle ORM; automatically activates `MemoryEventsRepo` if PostgreSQL is offline so the app always runs seamlessly. | Verified |
| **A9: Analytics Dashboard** | Real-time KPI summary, transparent 0–100 Risk Score formula, Chart.js activity visualizations, live audit log, and CSV export. | Verified |
| **A10: Enterprise Hardening** | Fail-closed error handling (State C dialog), network-level safety net (`onBeforeRequest`), origin lockdown to trusted domains. | Verified |
| **Modern Desktop UX** | Lottie Bodymovin shield startup animation, collapsible sidebar with smooth micro-interactions, spring animations, and tab shifting transitions. | Verified |

---

## Architecture at a Glance

Walled Guard hosts ChatGPT and Perplexity inside dedicated Electron `WebContentsView` containers isolated under the persistent partition `persist:walled-guard`. This ensures session cookies and logins persist across app restarts without leaking data to third-party processes.

```
┌─────────────────────────────────────────────────────────────┐
│             Walled Guard (Standalone Desktop App)           │
│  Tabs: [ChatGPT]  [Perplexity]  [Dashboard]  [Settings]     │
├─────────────────────────────────────────────────────────────┤
│  Capture-Phase Gate  ──▶  IPC Scan Request  ──▶  Scanner    │
│  (Hold DOM Event)                                 │         │
│         ▲                                         ▼         │
│         │                                  Marker Found?    │
│         │                                    /        \     │
│         │                                  YES         NO   │
│         │                                   │           │   │
│    Release Action                   Native Dialog   Instant │
│  (Continue: Replay /               [Continue/Cancel] Submit │
│   Cancel: Discard)                                          │
├─────────────────────────────────────────────────────────────┤
│  Analytics Engine  ──▶  PostgreSQL (or Auto In-Memory)      │
│  Local Audit Log   ──▶  SHA-256 Tamper-Evident Ledger       │
└─────────────────────────────────────────────────────────────┘
```

For detailed sequence diagrams, sniffer logic, and extension guides, see the [Architecture Documentation](docs/architecture-public.md).

---

## Quick Start (Development)

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- *(Optional)* **Docker Desktop**: If you wish to run a local PostgreSQL instance.

### 2. Clone & Install
```bash
git clone https://github.com/shubhamsahu4747/walled-guard-.git
cd walled-guard-
npm install
```

### 3. (Optional) Start Local PostgreSQL
If Docker is running, you can spin up the local PostgreSQL database:
```bash
docker compose up -d
```
> **Note**: If you skip this step, Walled Guard will automatically start in **In-Memory Fallback Mode**. The app is 100% functional, and an offline banner is displayed in the Dashboard.

### 4. Seed Demo Analytics
To populate realistic historical events for the dashboard charts:
```bash
npm run seed
```

### 5. Launch the Application
```bash
npm run dev
```

---

## Packaging & Installer

Walled Guard builds self-contained Windows distributions using `electron-builder`:

### Build Unpacked Directory
```bash
npm run dist
```
Output located at: `dist/win-unpacked/Walled Guard.exe`

### Build NSIS Installer & Portable Executable
```bash
npm run dist:installer
```
Output located at:
- Installer: `dist/Walled Guard-Setup-1.0.0.exe`
- Portable: `dist/Walled Guard-1.0.0-portable.exe`

---

## Test Suite & Quality Gates

The codebase maintains a 100% passing test matrix covering unit, integration, and security edge cases:

```bash
# Run strict TypeScript typechecking
npm run typecheck

# Run ESLint (enforcing functional coding style)
npm run lint

# Run all 62 Vitest test suites
npm test
```

### Test Coverage Highlights
- `tests/unit/gates.test.ts`: Capture-phase event prevention, one-shot WeakSet replay, input preservation.
- `tests/unit/dialog.test.ts`: Native dialog mock states (State A, State B, State C fail-closed).
- `tests/unit/scanner.test.ts`: Magic byte sniffing, chunked streaming, UTF-16 byte scanning, PDF extractor, image OCR with offline traineddata.
- `tests/unit/hardening.test.ts`: Corrupted PDFs, broken images, and oversized payloads fail-closed safely.
- `tests/unit/acceptance-matrix.test.ts`: Verification of all core acceptance criteria A1 through A10.

---

## User & Evaluator Walkthrough

### 1. Persistent Login
1. Launch Walled Guard.
2. Navigate to **ChatGPT** or **Perplexity**.
3. Sign in using your normal credentials (Google, Apple, or email).
4. Exit and restart the application: **You will remain logged in** because session data is stored securely in `persist:walled-guard`.

### 2. Testing Text Prompt DLP
- **Clean prompt**: Type `What is the speed of light?` and hit `Enter`. Result: Submits immediately.
- **Sensitive prompt**: Type `Here is WALLED_SENSITIVE for analysis.` and hit `Enter`.
  - Native dialog appears: `Sensitive Data Detected`.
  - Press `Esc` or click `Cancel`.
  - Prompt remains intact in the text area.
  - Press `Enter` again and click `Continue` to submit.

### 3. Testing File Upload DLP
Test files are pre-generated in `tests/fixtures/`:
- `clean.txt` / `clean.pdf`: Submits immediately without alert.
- `marked.txt`: Text file with `WALLED_SENSITIVE`. Triggers State B file dialog.
- `marked-text-layer.pdf`: PDF document with text layer containing `WALLED_SENSITIVE`. Triggers dialog; canceling clears the attachment input.
- `marked.png`: Image containing `WALLED_SENSITIVE` rendered in pixels. Scanned by offline OCR and blocked before transmission.

### 4. Viewing Analytics & Exporting Audit Logs
1. Click the **Dashboard** tab.
2. Review real-time KPIs, Risk Score formula breakdown, and Chart.js visualizations.
3. Filter audit records by `Blocked` or `Allowed`.
4. Click **Export CSV** to download compliance logs.

---

## Documentation Index

- [Architecture & System Design](docs/architecture-public.md)
- [Video Demo Script & Walkthrough](docs/demo-script.md)
- [Acceptance Criteria Test Matrix](docs/test-matrix.md)
- [DOM Selector Verification Log](docs/selectors-log.md)

---

## License

ISC License. Built for the Walled AI Candidate Screening Assignment.
