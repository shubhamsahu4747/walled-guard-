# selectors-log.md: Verified Live Selectors Log
Date checked: 2026-11-21
Electron Version: 45.4.1
Chrome User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36

## 1. Risk Smoke Test Findings
- **Cloudflare / Bot Challenge**:
  - ChatGPT: PASSED (no bot block)
  - Perplexity: PASSED (no bot block)
- **Session Persistence**: Tested with partition `persist:walled-guard`
- **User Agent Applied**: Standard Chrome 131 Desktop User Agent successfully bypasses bot flags.

## 2. ChatGPT (https://chatgpt.com) Live Selectors
- **Editor**: `textarea[placeholder*="Ask"]`
  - Tag: `TEXTAREA`
  - contentEditable: `false`
  - Fallbacks: `['#prompt-textarea', 'div[contenteditable="true"]', 'textarea']`
- **Send Button**: `button[aria-label*="Send"]`
  - Fallbacks: `['button[data-testid="send-button"]', 'button[data-testid="fruitjuice-send-button"]', 'button[aria-label*="Send"]', 'form button']`
- **File Input**: `input[type="file"]`
  - Fallbacks: `['input[type="file"]']`
- **Drop Zone**: `form`
  - Fallbacks: `['#prompt-textarea', 'form', 'main']`
- **Assistant Message Container**: `[data-message-author-role="assistant"]`
  - Fallbacks: `['[data-message-author-role="assistant"]', 'div[data-testid="conversation-turn-agent"]', '.agent-turn', '.prose']`

## 3. Perplexity (https://www.perplexity.ai) Live Selectors
- **Editor**: `div[contenteditable="true"]`
  - Tag: `DIV`
  - Fallbacks: `['textarea[placeholder*="Ask"]', 'textarea', 'div[contenteditable="true"]', '[role="textbox"]']`
- **Send Button**: `button[aria-label*="Submit"]`
  - Fallbacks: `['button[aria-label*="Submit"]', 'button[aria-label*="Search"]', 'button[aria-label*="Ask"]', 'button[type="submit"]', 'form button']`
- **File Input**: `input[type="file"]`
  - Fallbacks: `['input[type="file"]']`
- **Drop Zone**: `main`
  - Fallbacks: `['textarea', 'form', 'main', '[role="presentation"]']`
- **Assistant Message Container**: `.prose`
  - Fallbacks: `['[data-testid="answer-content"]', '.prose', '.default.font-sans.text-base']`

## 4. Verification Notes
- Inspected live in Electron Chromium 156.0.8078.100 on 2026-11-21T05:58:06.222Z.
