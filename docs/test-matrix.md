# test-matrix.md: Walled Guard Acceptance & QA Test Matrix

**Date verified**: 2026-11-21  
**Environment**: Windows 11 x64, Node v24.22.1, Electron 45.4.1 (Chromium 156.0.8078.100)  
**Test Suite Status**: 62 / 62 Tests Passing (Vitest automated unit + acceptance suite)

---

## 1. Core Acceptance Criteria Matrix (A1 – A10)

| # | Scenario | Target Site | Input / Trigger | Expected Behavior | Observed Result | Status | Scan Latency |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **A1** | Prompt without marker | ChatGPT & Perplexity | Text prompt without `WALLED_SENSITIVE` | Sent immediately, no native dialog, no perceptible delay | Prompt submitted without dialog | **PASS** | < 10 ms |
| **A2** | Prompt with marker | ChatGPT | Prompt: *"Summarise the Q3 WALLED_SENSITIVE budget..."* | Native warning dialog shown before transmission with snippet | Native dialog displayed, default focus on Cancel, Esc cancels | **PASS** | 4 ms |
| **A2b** | Prompt with marker | Perplexity | Prompt: *"Summarise the Q3 WALLED_SENSITIVE budget..."* | Native warning dialog shown before transmission with snippet | Native dialog displayed, default focus on Cancel, Esc cancels | **PASS** | 5 ms |
| **A3** | .txt file with marker | ChatGPT & Perplexity | Upload `marked.txt` via file picker or drag-and-drop | Native dialog shown before upload begins, stating file (text) | Dialog shown: *"Sensitive marker found in a file (text)"* | **PASS** | 8 ms |
| **A4** | PDF with marker (text layer) | ChatGPT & Perplexity | Upload `marked-text-layer.pdf` | Native dialog shown before upload, citing text layer / page | Dialog shown: *"Found on page 1 in text layer"* | **PASS** | 42 ms |
| **A4b**| Scanned PDF (OCR) | ChatGPT & Perplexity | Upload scanned PDF containing rendered marker image | Native dialog shown before upload, citing OCR detection | Dialog shown with OCR source attribution | **PASS** | 1.8 s |
| **A5** | Image with marker | ChatGPT & Perplexity | Upload `marked.png` | Native dialog shown before upload, citing OCR | Dialog shown: *"Found using OCR"* | **PASS** | 780 ms |
| **A6** | User clicks Continue | ChatGPT & Perplexity | Click "Continue" in native dialog | Original action proceeds normally, content is unchanged, not blocked | Action replayed cleanly via one-shot bypass; content untouched | **PASS** | Immediate |
| **A7** | User clicks Cancel | ChatGPT & Perplexity | Click "Cancel" (or press Esc) in native dialog | Action blocked. Text remains in editor; file input is cleared | Prompt remains in editor for editing; file input reset to empty | **PASS** | Immediate |
| **A8** | ChatGPT response recolored | ChatGPT (`chatgpt.com`) | View streamed response and history chat | AI text color changed to configured green (`#00A86B`) | Assistant text recolored; code blocks, links, tables remain legible | **PASS** | CSS inject |
| **A9** | Perplexity response recolored | Perplexity (`perplexity.ai`)| View answer content and prose blocks | AI text color changed to configured green (`#00A86B`) | Assistant text recolored; code blocks, links, tables remain legible | **PASS** | CSS inject |
| **A10**| Clean file upload | ChatGPT & Perplexity | Upload `clean.png`, `clean.pdf`, `clean.txt` | Upload proceeds normally without native dialog | Upload starts with zero interruptions | **PASS** | 12 ms |

---

## 2. Hardening & Edge Cases Matrix

| ID | Edge Case Scenario | Test Condition | Expected Behavior | Observed Result | Status |
|:---|:---|:---|:---|:---|:---:|
| **E1** | Multi-line Shift+Enter | User presses `Shift+Enter` in editor | Line break inserted without submission or dialog | Line break inserted normally | **PASS** |
| **E2** | IME Composition | User inputs multi-byte composition (CJK/IME) | Enter key during `isComposing` does not submit or trigger | Keystroke ignored until composition ends | **PASS** |
| **E3** | Re-upload retry after Cancel (R4.3) | Same sensitive file re-uploaded after clicking Cancel | Native dialog must appear again (verdict cached, decision NOT cached) | Dialog appears again on retry | **PASS** |
| **E4** | Mixed/Lower case marker | Text contains `wAlLeD_sEnSiTiVe` | Normalized and detected | Detected via NFKC uppercase fold | **PASS** |
| **E5** | Hidden zero-width characters | Text contains `WALLED\u200B_SENSITIVE` | Zero-width chars stripped and detected | Stripped and detected | **PASS** |
| **E6** | Marker split across stream chunks | Marker split across boundary `WALLED_` + `SENSITIVE` | Boundary overlap buffer catches marker | Detected across boundary | **PASS** |
| **E7** | Dark-mode screenshot | Image with dark background (`#121212`) and light text | Inverted second-pass OCR detects marker | Detected via inverted pass | **PASS** |
| **E8** | Oversized file (> 50 MB) | File size 52 MB | Fails closed: native dialog states file exceeds limit | Native dialog shown with limit reason | **PASS** |
| **E9** | Corrupted / Encrypted PDF | Malformed `%PDF` binary bytes | Fails closed: native dialog states scan failed | Native dialog shown with fail reason | **PASS** |
| **E10**| Corrupted image file | Corrupted PNG header / truncated bytes | Fails closed: native dialog states scan failed | Native dialog shown with fail reason | **PASS** |
| **E11**| External Link Navigation | User clicks external link in ChatGPT / Perplexity | Intercepted and opened in default OS browser | Opened in system browser; tab locked | **PASS** |
| **E12**| Database outage fallback | PostgreSQL disconnected or down | App automatically switches to memory repo; guard never blocks | Guard & dialog unaffected; in-memory fallback active | **PASS** |

---

## 3. Summary
All core acceptance criteria (**A1 through A10**) and all 12 edge cases have passed verification.
