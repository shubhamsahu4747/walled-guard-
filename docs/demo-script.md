# Walled Guard: 5-Minute Video Walkthrough & Demo Script

This script provides an exact, second-by-second guide for recording the evaluation video walkthrough. It verifies every requirement (**A1 through A10**) across both ChatGPT and Perplexity.

---

## Pre-Recording Checklist

1. **Launch Environment**:
   - Run `npm run seed` to populate realistic historical analytics data.
   - Start Walled Guard via `npm run dev` (or launch `dist\win-unpacked\Walled Guard.exe`).
   - Ensure you are logged into ChatGPT and Perplexity (sessions are persisted in `persist:walled-guard`).
2. **Test Files Ready**:
   - `tests/fixtures/clean.txt`
   - `tests/fixtures/marked.txt`
   - `tests/fixtures/marked-text-layer.pdf`
   - `tests/fixtures/marked.png`
3. **Screen Setup**:
   - Resolution: 1080p (1920x1080) or 2K.
   - Display Walled Guard window clearly showing the tab bar at the top (`ChatGPT`, `Perplexity`, `Dashboard`, `Settings`).

---

## Timestamped Walkthrough Script (Total: 5:00)

### Segment 1: Introduction & Architecture Overview (0:00 - 0:35)
- **Speaker Action**: Show the Walled Guard application window.
- **Narration**:
  > *"Welcome to the demonstration of Walled Guard—a lightweight, single-install desktop DLP solution built with Electron and TypeScript for ChatGPT and Perplexity. Walled Guard requires zero browser extensions, zero background daemons, and zero proxy certificates. It embeds live web views in an isolated, persistent partition, intercepting prompts and file uploads in the capture phase before data leaves the device."*
- **Action**: Point out the top navigation tabs: **ChatGPT**, **Perplexity**, **Dashboard**, **Settings**.

---

### Segment 2: Criterion A1 & A2 — Clean Prompt vs. Sensitive Prompt on ChatGPT (0:35 - 1:30)
- **Speaker Action**: Click the **ChatGPT** tab.
- **Test A1 (Clean prompt submission)**:
  - Type in the chat input: `"Explain the concept of zero-knowledge proofs in one sentence."`
  - Press `Enter`.
  - **Observe**: The prompt submits immediately without any dialog. Scan latency is sub-50ms.
- **Test A2 (Sensitive prompt interception with Cancel)**:
  - Type: `"Here is confidential client record: WALLED_SENSITIVE please summarize."`
  - Press `Enter`.
  - **Observe**:
    - The native desktop dialog (`dialog.showMessageBox`) immediately pops up:
      - **Title**: `Sensitive Data Detected`
      - **Message**: `Sensitive marker detected in prompt: WALLED_SENSITIVE`
      - **Buttons**: `Continue` and `Cancel` (with `Cancel` set as default).
    - Press `Esc` (or click `Cancel`).
    - **Observe**:
      - The dialog closes.
      - **No network request was sent**.
      - The prompt text remains intact and fully editable in the chat input box. Focus is restored.

---

### Segment 3: Criterion A3 — Re-try & Continue Flow (1:30 - 2:05)
- **Speaker Action**:
  - Keep the exact same sensitive prompt in the input: `"Here is confidential client record: WALLED_SENSITIVE please summarize."`
  - Hit `Enter` again.
  - **Observe**: The native dialog appears again immediately.
  - **Narration**:
    > *"Notice that retrying after cancel re-triggers the dialog. Walled Guard caches scan verdicts, never user decisions, preventing accidental bypass."*
  - Click **Continue**.
  - **Observe**:
    - The prompt is released untouched and submitted to ChatGPT.
    - Zero modification to the user's input.

---

### Segment 4: Criterion A4 & A5 — File Upload DLP (PDF, Images, OCR) (2:05 - 2:55)
- **Speaker Action**: Demonstrate file interception.
- **Test A4 (PDF with text layer)**:
  - Click the ChatGPT attachment icon (or drag and drop `tests/fixtures/marked-text-layer.pdf` into the chat area).
  - **Observe**:
    - Native dialog triggers instantly: `Sensitive marker detected in file: marked-text-layer.pdf`.
    - Click `Cancel`.
    - The file is stripped from the attachment tray; `input.value` is cleared.
- **Test A5 (Image with offline OCR)**:
  - Drag and drop `tests/fixtures/marked.png` into the ChatGPT upload area.
  - **Observe**:
    - Offline Tesseract OCR processes the image in ~400ms using bundled `eng.traineddata`.
    - Native dialog triggers: `Sensitive marker detected in image via OCR: marked.png`.
    - Click `Cancel`.
- **Test Clean File**:
  - Drop `tests/fixtures/clean.txt` or `tests/fixtures/clean.pdf`.
  - **Observe**: Uploads cleanly without triggering any alert.

---

### Segment 5: Criterion A6 — Perplexity Parity (2:55 - 3:35)
- **Speaker Action**: Click the **Perplexity** tab.
- **Narration**:
  > *"Walled Guard provides identical protection on Perplexity (`https://www.perplexity.ai`)."*
- **Action**:
  - Type in Perplexity search bar: `"Compare quarterly revenue for WALLED_SENSITIVE"`.
  - Click the Ask / Submit button.
  - **Observe**: Native dialog triggers with identical `Continue` and `Cancel` options. Click `Cancel`.
  - Upload `tests/fixtures/marked.txt` to Perplexity file input.
  - **Observe**: Native dialog triggers and cancels cleanly.

---

### Segment 6: Criterion A7 — Assistant Response Recoloring (`#00A86B`) (3:35 - 4:10)
- **Speaker Action**: Show completed responses on both ChatGPT and Perplexity.
- **Observe**:
  - Assistant response body text is rendered in **Spring Green** (`#00A86B`).
  - Code blocks (`<pre>`, `<code>`), hyperlinks (`<a>`), table headers, and syntax tokens retain their native styling (`revert !important`).
  - **Narration**:
    > *"All assistant answers are recolored to Spring Green (#00A86B) dynamically via a MutationObserver as tokens stream in. Notice that code syntax, links, and tables remain completely unaffected."*

---

### Segment 7: Criterion A8, A9 & A10 — Dashboard & Settings (4:10 - 5:00)
- **Speaker Action**: Click the **Dashboard** tab.
- **Observe**:
  - **KPI Cards**: Total Scans, Blocked Events, Clean Traffic, and the calculated **Risk Score (0–100)**.
  - **Charts**:
    - Hourly Activity Chart (Allowed vs Blocked).
    - Channel Breakdown (Prompts vs Files).
    - Site Distribution (ChatGPT vs Perplexity).
  - **Live Audit Table**:
    - Shows real-time event entries with Timestamp, Site, Channel, Verdict, Action, and Latency.
    - Click the filter buttons (`All`, `Blocked`, `Allowed`).
    - Click **Export CSV** to demonstrate audit compliance export.
  - **Database Status Indicator**:
    - Highlight the database badge (showing `PostgreSQL Connected` or `In-Memory Fallback`).
- **Speaker Action**: Click the **Settings** tab.
  - Show configurable markers (`WALLED_SENSITIVE`), response recolor customization, retention days, and test connection button.
- **Conclusion**:
  > *"Walled Guard provides comprehensive, non-intrusive DLP protection for generative AI workflows, backed by transparent analytics and rock-solid fail-closed security. Thank you."*
