// Walled Guard Content Script for ChatGPT & Perplexity
// Runs inside the real browser (Chrome / Edge)

(function () {
  'use strict';

  const hostname = window.location.hostname;
  const isChatGPT = hostname.includes('chatgpt.com') || hostname.includes('openai.com');
  const isPerplexity = hostname.includes('perplexity.ai');

  if (!isChatGPT && !isPerplexity) return;

  const siteId = isChatGPT ? 'chatgpt' : 'perplexity';
  let isReplaying = false;

  // ==========================================
  // 1. Response Text Recoloring (CSS Injection)
  // ==========================================
  const RECOLOR_COLOR = '#00A86B'; // Spring Green
  const RECOLOR_CSS = `
    /* ChatGPT Assistant Responses */
    [data-message-author-role="assistant"],
    div[data-testid="conversation-turn-agent"],
    .agent-turn,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) {
      --text-primary: ${RECOLOR_COLOR} !important;
      color: ${RECOLOR_COLOR} !important;
    }
    [data-message-author-role="assistant"] p,
    [data-message-author-role="assistant"] li,
    [data-message-author-role="assistant"] span:not([class*="token"]),
    [data-message-author-role="assistant"] strong,
    [data-message-author-role="assistant"] em,
    [data-message-author-role="assistant"] div.markdown,
    [data-message-author-role="assistant"] div.markdown *,
    .agent-turn p,
    .agent-turn li,
    .agent-turn span:not([class*="token"]),
    .agent-turn strong,
    .agent-turn em,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) .markdown,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) .markdown *,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) p,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) li,
    article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) span:not([class*="token"]) {
      color: ${RECOLOR_COLOR} !important;
    }

    /* Perplexity Assistant Responses */
    [data-testid="answer-content"],
    .prose.dark\\:prose-invert,
    .prose {
      --text-primary: ${RECOLOR_COLOR} !important;
      color: ${RECOLOR_COLOR} !important;
    }
    [data-testid="answer-content"] p,
    [data-testid="answer-content"] span:not([class*="token"]),
    [data-testid="answer-content"] li,
    [data-testid="answer-content"] strong,
    [data-testid="answer-content"] em,
    .prose p,
    .prose span:not([class*="token"]),
    .prose li,
    .prose strong,
    .prose em {
      color: ${RECOLOR_COLOR} !important;
    }

    /* Readability Preservations: Revert code, links, tables, buttons */
    [data-message-author-role="assistant"] pre,
    [data-message-author-role="assistant"] pre *,
    [data-message-author-role="assistant"] code,
    [data-message-author-role="assistant"] code *,
    [data-message-author-role="assistant"] a,
    [data-message-author-role="assistant"] a *,
    [data-message-author-role="assistant"] table,
    [data-message-author-role="assistant"] table *,
    [data-message-author-role="assistant"] button,
    [data-message-author-role="assistant"] button *,
    [data-message-author-role="assistant"] svg,
    [data-testid="answer-content"] pre,
    [data-testid="answer-content"] pre *,
    [data-testid="answer-content"] code,
    [data-testid="answer-content"] code *,
    [data-testid="answer-content"] a,
    [data-testid="answer-content"] a *,
    [data-testid="answer-content"] table,
    [data-testid="answer-content"] table *,
    [data-testid="answer-content"] button,
    [data-testid="answer-content"] button *,
    [data-testid="answer-content"] svg,
    .prose pre,
    .prose pre *,
    .prose code,
    .prose code *,
    .prose a,
    .prose a *,
    .prose table,
    .prose table *,
    .prose button,
    .prose button *,
    .prose svg {
      color: revert !important;
    }
  `;

  function injectStyles() {
    let style = document.getElementById('walled-guard-extension-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'walled-guard-extension-style';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = RECOLOR_CSS;
  }

  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  }

  // ==========================================
  // 2. Notification Toast
  // ==========================================
  function showToast(message, isWarning = false) {
    let toast = document.getElementById('walled-guard-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'walled-guard-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        padding: 12px 18px;
        background: #18181b;
        color: #f4f4f5;
        border: 1px solid ${isWarning ? '#f59e0b' : '#10b981'};
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isWarning ? '#f59e0b' : '#10b981'};"></span>
      <span>${message}</span>
    `;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
      }
    }, 4500);
  }

  // ==========================================
  // 3. Prompt Text Extraction & Interception
  // ==========================================
  const EDITOR_SELECTORS = [
    '#prompt-textarea',
    'div[id="prompt-textarea"]',
    'div[contenteditable="true"]',
    'textarea[placeholder*="Ask" i]',
    'textarea[data-id="root"]',
    'textarea',
    '[role="textbox"]',
    '#ask-input'
  ];

  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[aria-label*="Ask" i]',
    'form button[type="submit"]',
    'button[type="submit"]'
  ];

  function extractTextFromElement(el) {
    if (!el) return '';
    if (typeof el.value === 'string' && el.value.trim().length > 0) {
      return el.value.trim();
    }
    if (typeof el.innerText === 'string' && el.innerText.trim().length > 0) {
      return el.innerText.trim();
    }
    if (typeof el.textContent === 'string' && el.textContent.trim().length > 0) {
      return el.textContent.trim();
    }
    return '';
  }

  function getPromptText(target) {
    if (target) {
      const text = extractTextFromElement(target);
      if (text) return text;
      for (const sel of EDITOR_SELECTORS) {
        try {
          const closest = target.closest(sel);
          if (closest) {
            const cText = extractTextFromElement(closest);
            if (cText) return cText;
          }
        } catch {}
      }
    }

    if (document.activeElement) {
      const activeText = extractTextFromElement(document.activeElement);
      if (activeText) return activeText;
    }

    for (const sel of EDITOR_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        const text = extractTextFromElement(el);
        if (text) return text;
      }
    }

    return '';
  }

  function isSendButton(target) {
    if (!target) return false;
    for (const sel of SEND_BUTTON_SELECTORS) {
      try {
        if (target.matches && target.matches(sel)) return true;
        if (target.closest && target.closest(sel)) return true;
      } catch {}
    }
    return false;
  }

  function findSendButton() {
    for (const sel of SEND_BUTTON_SELECTORS) {
      try {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) return btn;
      } catch {}
    }
    return null;
  }

  function scanPromptWithNativeHost(text, onDecision) {
    chrome.runtime.sendMessage({
      action: 'SCAN_PROMPT',
      site: siteId,
      text: text
    }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[Walled Guard] Native host message error:', chrome.runtime.lastError.message);
        onDecision('CONTINUE');
        return;
      }

      const decision = res && res.decision ? res.decision : (res && res.action === 'allow' ? 'CONTINUE' : 'CANCEL');
      onDecision(decision);
    });
  }

  // Intercept Enter key
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isReplaying) return;

    const text = getPromptText(e.target);
    if (!text) return;

    // Fast-path: if text doesn't contain marker, allow immediate submission and log clean event
    if (!text.includes('WALLED_SENSITIVE')) {
      chrome.runtime.sendMessage({
        action: 'LOG_CLEAN_PROMPT',
        site: siteId,
        text: text
      });
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    scanPromptWithNativeHost(text, (decision) => {
      if (decision === 'CONTINUE') {
        isReplaying = true;
        const btn = findSendButton();
        if (btn) {
          btn.click();
        } else {
          // Re-dispatch enter key
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          (e.target || document.activeElement || document).dispatchEvent(enterEvent);
        }
        isReplaying = false;
      } else {
        showToast('Prompt submission blocked by Walled Guard policy.', true);
      }
    });
  }, true);

  // Intercept Click on Send Button
  window.addEventListener('click', (e) => {
    if (isReplaying) return;
    if (!isSendButton(e.target)) return;

    const text = getPromptText(e.target);
    if (!text) return;

    if (!text.includes('WALLED_SENSITIVE')) {
      chrome.runtime.sendMessage({
        action: 'LOG_CLEAN_PROMPT',
        site: siteId,
        text: text
      });
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    const clickedBtn = e.target.closest ? (e.target.closest('button') || e.target) : e.target;

    scanPromptWithNativeHost(text, (decision) => {
      if (decision === 'CONTINUE') {
        isReplaying = true;
        clickedBtn.click();
        isReplaying = false;
      } else {
        showToast('Prompt submission blocked by Walled Guard policy.', true);
      }
    });
  }, true);

  // ==========================================
  // 4. File Upload Interception
  // ==========================================
  function scanFileWithNativeHost(file, onDecision) {
    const reader = new FileReader();
    const isText = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json');

    reader.onload = () => {
      const dataPayload = isText ? reader.result : reader.result.split(',')[1]; // base64 payload
      chrome.runtime.sendMessage({
        action: 'SCAN_FILE',
        site: siteId,
        fileName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'application/octet-stream',
        isText: isText,
        data: dataPayload
      }, (res) => {
        if (chrome.runtime.lastError) {
          onDecision('CONTINUE');
          return;
        }
        const decision = res && res.decision ? res.decision : (res && res.action === 'allow' ? 'CONTINUE' : 'CANCEL');
        onDecision(decision);
      });
    };

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  }

  // Intercept Drag & Drop
  window.addEventListener('drop', (e) => {
    if (isReplaying) return;
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    let processed = 0;
    let anyBlocked = false;

    Array.from(files).forEach((file) => {
      scanFileWithNativeHost(file, (decision) => {
        processed++;
        if (decision !== 'CONTINUE') {
          anyBlocked = true;
        }

        if (processed === files.length) {
          if (anyBlocked) {
            showToast('File upload blocked by Walled Guard policy.', true);
          } else {
            // All files approved, re-dispatch drop
            isReplaying = true;
            const dropEvent = new DragEvent('drop', e);
            e.target.dispatchEvent(dropEvent);
            isReplaying = false;
          }
        }
      });
    });
  }, true);

  // Intercept File Picker Input changes
  window.addEventListener('change', (e) => {
    if (isReplaying) return;
    const target = e.target;
    if (!target || target.tagName !== 'INPUT' || target.type !== 'file') return;
    const files = target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      scanFileWithNativeHost(file, (decision) => {
        if (decision !== 'CONTINUE') {
          target.value = ''; // Block and clear the input
          showToast(`File upload "${file.name}" blocked by Walled Guard policy.`, true);
        }
      });
    });
  }, true);

  console.log(`[Walled Guard] Extension active on ${siteId} (${hostname})`);
})();
