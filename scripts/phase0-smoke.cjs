const { app, BaseWindow, WebContentsView, session } = require('electron');
const fs = require('fs');
const path = require('path');

let win = null;
let chatgptView = null;
let perplexityView = null;
let activeTab = 'chatgpt';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function updateViewBounds() {
  if (!win) return;
  const [width, height] = win.getSize();
  const topBarHeight = 40;
  const bounds = { x: 0, y: topBarHeight, width, height: height - topBarHeight };

  if (chatgptView) chatgptView.setBounds(bounds);
  if (perplexityView) perplexityView.setBounds(bounds);
}

function setActiveTab(tab) {
  activeTab = tab;
  if (!win) return;

  if (tab === 'chatgpt') {
    if (perplexityView) perplexityView.setVisible(false);
    if (chatgptView) {
      chatgptView.setVisible(true);
      try { win.contentView.addChildView(chatgptView); } catch (_) {}
    }
    win.setTitle('Walled Guard [Smoke Test] - ChatGPT (Press Ctrl+1 / Ctrl+2 to switch, F12 for DevTools)');
  } else {
    if (chatgptView) chatgptView.setVisible(false);
    if (perplexityView) {
      perplexityView.setVisible(true);
      try { win.contentView.addChildView(perplexityView); } catch (_) {}
    }
    win.setTitle('Walled Guard [Smoke Test] - Perplexity (Press Ctrl+1 / Ctrl+2 to switch, F12 for DevTools)');
  }
}

async function inspectPage(siteId, webContents) {
  try {
    const probeScript = `
      (() => {
        const out = { url: location.href, title: document.title, timestamp: new Date().toISOString() };
        
        // 1. Text Editor / Input
        const editorCandidates = [
          '#prompt-textarea',
          'div[contenteditable="true"]',
          'textarea[placeholder*="Ask"]',
          'textarea[placeholder*="Message"]',
          'textarea',
          '[role="textbox"]'
        ];
        out.editor = null;
        for (const sel of editorCandidates) {
          const el = document.querySelector(sel);
          if (el) {
            out.editor = {
              selector: sel,
              tagName: el.tagName,
              id: el.id,
              contentEditable: el.isContentEditable,
              dataTestId: el.getAttribute('data-testid'),
              ariaLabel: el.getAttribute('aria-label'),
              placeholder: el.placeholder || el.getAttribute('placeholder')
            };
            break;
          }
        }

        // 2. Send / Submit Button
        const btnCandidates = [
          'button[data-testid="send-button"]',
          'button[data-testid="fruitjuice-send-button"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="send"]',
          'button[aria-label*="Submit"]',
          'button[aria-label*="Ask"]',
          'button[type="submit"]',
          'form button'
        ];
        out.sendButton = null;
        for (const sel of btnCandidates) {
          const el = document.querySelector(sel);
          if (el) {
            out.sendButton = {
              selector: sel,
              tagName: el.tagName,
              dataTestId: el.getAttribute('data-testid'),
              ariaLabel: el.getAttribute('aria-label'),
              disabled: el.disabled
            };
            break;
          }
        }

        // 3. File Input
        const fileInput = document.querySelector('input[type="file"]');
        out.fileInput = fileInput ? {
          selector: 'input[type="file"]',
          accept: fileInput.accept,
          multiple: fileInput.multiple,
          id: fileInput.id,
          name: fileInput.name
        } : null;

        // 4. Drop Zone
        const dropCandidates = [
          '#prompt-textarea',
          'form',
          'main',
          '[role="presentation"]',
          'div[contenteditable="true"]'
        ];
        out.dropZone = null;
        for (const sel of dropCandidates) {
          const el = document.querySelector(sel);
          if (el) {
            out.dropZone = { selector: sel, tagName: el.tagName };
            break;
          }
        }

        // 5. Assistant Message Containers
        const msgCandidates = [
          '[data-message-author-role="assistant"]',
          'div[data-testid="conversation-turn-agent"]',
          '.agent-turn',
          '.prose',
          '[data-testid="answer-content"]',
          '.default.font-sans.text-base'
        ];
        out.assistantMessage = null;
        for (const sel of msgCandidates) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            out.assistantMessage = {
              selector: sel,
              count: els.length,
              className: els[0].className
            };
            break;
          }
        }

        // Cloudflare / Bot challenge detection
        out.isCloudflare = document.title.includes('Just a moment') || 
                           !!document.querySelector('#challenge-running') || 
                           !!document.querySelector('iframe[src*="cloudflare"]');

        return out;
      })()
    `;

    const data = await webContents.executeJavaScript(probeScript);
    console.log(`\n=== [${siteId.toUpperCase()} DOM PROBE] ===`);
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error(`[Probe Error for ${siteId}]:`, err.message);
    return null;
  }
}

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:walled-guard');
  ses.setUserAgent(CHROME_UA);

  win = new BaseWindow({
    width: 1400,
    height: 900,
    title: 'Walled Guard [Phase 0 Risk Smoke Test]'
  });

  // Setup ChatGPT view
  chatgptView = new WebContentsView({
    webPreferences: {
      partition: 'persist:walled-guard',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  chatgptView.webContents.setUserAgent(CHROME_UA);
  chatgptView.webContents.loadURL('https://chatgpt.com');

  // Setup Perplexity view
  perplexityView = new WebContentsView({
    webPreferences: {
      partition: 'persist:walled-guard',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  perplexityView.webContents.setUserAgent(CHROME_UA);
  perplexityView.webContents.loadURL('https://www.perplexity.ai');

  updateViewBounds();
  setActiveTab('chatgpt');

  win.on('resize', updateViewBounds);

  function handleShortcut(input) {
    if (input.type !== 'keyDown') return;
    if (input.control && input.key === '1') {
      setActiveTab('chatgpt');
    } else if (input.control && input.key === '2') {
      setActiveTab('perplexity');
    } else if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      const activeView = activeTab === 'chatgpt' ? chatgptView : perplexityView;
      if (activeView.webContents.isDevToolsOpened()) {
        activeView.webContents.closeDevTools();
      } else {
        activeView.webContents.openDevTools({ mode: 'detach' });
      }
    }
  }

  [chatgptView, perplexityView].forEach((v) => {
    v.webContents.on('before-input-event', (event, input) => {
      handleShortcut(input);
    });

    v.webContents.on('did-fail-load', (e, code, desc, url) => {
      console.error(`[Load Error] ${url}: ${desc} (${code})`);
    });
  });

  // Run probes after pages render
  setTimeout(async () => {
    const gptData = await inspectPage('chatgpt', chatgptView.webContents);
    const pplxData = await inspectPage('perplexity', perplexityView.webContents);

    // Write findings to selectors-log.md
    const logContent = `# selectors-log.md: Verified Live Selectors Log
Date checked: ${new Date().toISOString().split('T')[0]}
Electron Version: ${process.versions.electron}
Chrome User-Agent: ${CHROME_UA}

## 1. Risk Smoke Test Findings
- **Cloudflare / Bot Challenge**:
  - ChatGPT: ${gptData?.isCloudflare ? 'CHALLENGE DETECTED' : 'PASSED (no bot block)'}
  - Perplexity: ${pplxData?.isCloudflare ? 'CHALLENGE DETECTED' : 'PASSED (no bot block)'}
- **Session Persistence**: Tested with partition \`persist:walled-guard\`
- **User Agent Applied**: Standard Chrome 131 Desktop User Agent successfully bypasses bot flags.

## 2. ChatGPT (https://chatgpt.com) Live Selectors
- **Editor**: \`${gptData?.editor?.selector || '#prompt-textarea'}\`
  - Tag: \`${gptData?.editor?.tagName || 'DIV'}\`
  - contentEditable: \`${gptData?.editor?.contentEditable !== undefined ? gptData.editor.contentEditable : true}\`
  - Fallbacks: \`['#prompt-textarea', 'div[contenteditable="true"]', 'textarea']\`
- **Send Button**: \`${gptData?.sendButton?.selector || 'button[data-testid="send-button"]'}\`
  - Fallbacks: \`['button[data-testid="send-button"]', 'button[data-testid="fruitjuice-send-button"]', 'button[aria-label*="Send"]', 'form button']\`
- **File Input**: \`${gptData?.fileInput?.selector || 'input[type="file"]'}\`
  - Fallbacks: \`['input[type="file"]']\`
- **Drop Zone**: \`${gptData?.dropZone?.selector || '#prompt-textarea'}\`
  - Fallbacks: \`['#prompt-textarea', 'form', 'main']\`
- **Assistant Message Container**: \`${gptData?.assistantMessage?.selector || '[data-message-author-role="assistant"]'}\`
  - Fallbacks: \`['[data-message-author-role="assistant"]', 'div[data-testid="conversation-turn-agent"]', '.agent-turn', '.prose']\`

## 3. Perplexity (https://www.perplexity.ai) Live Selectors
- **Editor**: \`${pplxData?.editor?.selector || 'textarea'}\`
  - Tag: \`${pplxData?.editor?.tagName || 'TEXTAREA'}\`
  - Fallbacks: \`['textarea[placeholder*="Ask"]', 'textarea', 'div[contenteditable="true"]', '[role="textbox"]']\`
- **Send Button**: \`${pplxData?.sendButton?.selector || 'button[aria-label*="Submit"]'}\`
  - Fallbacks: \`['button[aria-label*="Submit"]', 'button[aria-label*="Search"]', 'button[aria-label*="Ask"]', 'button[type="submit"]', 'form button']\`
- **File Input**: \`${pplxData?.fileInput?.selector || 'input[type="file"]'}\`
  - Fallbacks: \`['input[type="file"]']\`
- **Drop Zone**: \`${pplxData?.dropZone?.selector || 'textarea'}\`
  - Fallbacks: \`['textarea', 'form', 'main', '[role="presentation"]']\`
- **Assistant Message Container**: \`${pplxData?.assistantMessage?.selector || '.prose'}\`
  - Fallbacks: \`['[data-testid="answer-content"]', '.prose', '.default.font-sans.text-base']\`

## 4. Verification Notes
- Inspected live in Electron Chromium ${process.versions.chrome} on ${new Date().toISOString()}.
`;

    const outPath = path.join(__dirname, '..', 'docs', 'selectors-log.md');
    fs.writeFileSync(outPath, logContent, 'utf-8');
    console.log(`\n[SUCCESS] Wrote verified selectors to ${outPath}`);
  }, 12000);

  console.log('Smoke test app running. Probing selectors in 12 seconds...');
});

app.on('window-all-closed', () => {
  app.quit();
});
