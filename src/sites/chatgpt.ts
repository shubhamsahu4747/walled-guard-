import { SiteAdapter } from './types';

function extractText(el: unknown): string {
  if (!el || typeof el !== 'object') return '';
  const anyEl = el as Record<string, unknown>;

  // Check .value (inputs, textareas)
  if (typeof anyEl.value === 'string' && anyEl.value.trim().length > 0) {
    return anyEl.value.trim();
  }

  // Check .innerText (contenteditable divs, ProseMirror)
  if (typeof anyEl.innerText === 'string' && anyEl.innerText.trim().length > 0) {
    return anyEl.innerText.trim();
  }

  // Check .textContent
  if (typeof anyEl.textContent === 'string' && anyEl.textContent.trim().length > 0) {
    return anyEl.textContent.trim();
  }

  return '';
}

export function createChatGPTAdapter(): SiteAdapter {
  return {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    selectors: {
      editor: [
        '#prompt-textarea',
        'div[id="prompt-textarea"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="Ask" i]',
        'textarea[data-id="root"]',
        'textarea',
        '[role="textbox"]'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[data-testid="composer-send-button"]',
        'button[data-testid="fruitjuice-send-button"]',
        'button[data-testid*="send" i]',
        'button[aria-label*="Send" i]',
        'button[aria-label*="Submit" i]',
        'button[aria-label*="Ask" i]',
        'form button[type="submit"]',
        'button[type="submit"]'
      ],
      fileInput: [
        'input[type="file"]'
      ],
      dropZone: [
        '#prompt-textarea',
        'form',
        'main'
      ],
      assistantMessage: [
        '[data-message-author-role="assistant"]',
        'div[data-testid="conversation-turn-agent"]',
        '.agent-turn',
        '.prose'
      ]
    },
    getPromptText(root = document, target?: Element | null): string {
      // 1. Try target or target's closest editor
      if (target) {
        const text = extractText(target);
        if (text) return text;
        if (typeof target.closest === 'function') {
          for (const sel of this.selectors.editor) {
            try {
              const closest = target.closest(sel);
              if (closest) {
                const cText = extractText(closest);
                if (cText) return cText;
              }
            } catch {}
          }
        }
      }

      // 2. Try document.activeElement
      if (typeof document !== 'undefined' && document.activeElement) {
        const active = document.activeElement;
        const text = extractText(active);
        if (text) return text;
        if (typeof active.closest === 'function') {
          for (const sel of this.selectors.editor) {
            try {
              const closest = active.closest(sel);
              if (closest) {
                const cText = extractText(closest);
                if (cText) return cText;
              }
            } catch {}
          }
        }
      }

      // 3. Search root using selectors
      const doc = root as { querySelectorAll?: (s: string) => NodeListOf<Element>; querySelector?: (s: string) => Element | null };
      for (const sel of this.selectors.editor) {
        try {
          if (typeof doc.querySelectorAll === 'function') {
            const matches = doc.querySelectorAll(sel);
            for (let i = 0; i < matches.length; i++) {
              const text = extractText(matches[i]);
              if (text) return text;
            }
          } else if (typeof doc.querySelector === 'function') {
            const el = doc.querySelector(sel);
            const text = extractText(el);
            if (text) return text;
          }
        } catch {}
      }

      // 4. Fallback: all contenteditable or textareas
      try {
        if (typeof doc.querySelectorAll === 'function') {
          const fallbacks = doc.querySelectorAll('div[contenteditable="true"], textarea, [role="textbox"]');
          for (let i = 0; i < fallbacks.length; i++) {
            const text = extractText(fallbacks[i]);
            if (text) return text;
          }
        }
      } catch {}

      return '';
    },
    responseCss(color: string): string {
      return `
        /* ChatGPT AI response text recoloring (R5.1 - R5.4) */
        [data-message-author-role="assistant"],
        div[data-testid="conversation-turn-agent"],
        .agent-turn,
        article[data-testid*="conversation-turn"]:not(:has([data-message-author-role="user"])) {
          --text-primary: ${color} !important;
          color: ${color} !important;
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
          color: ${color} !important;
        }
        /* Exclude code blocks, syntax highlight tokens, links, and tables for complete readability (R5.4) */
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
        article[data-testid*="conversation-turn"] pre,
        article[data-testid*="conversation-turn"] pre *,
        article[data-testid*="conversation-turn"] code,
        article[data-testid*="conversation-turn"] code *,
        article[data-testid*="conversation-turn"] a,
        article[data-testid*="conversation-turn"] a *,
        article[data-testid*="conversation-turn"] table,
        article[data-testid*="conversation-turn"] table *,
        article[data-testid*="conversation-turn"] button,
        article[data-testid*="conversation-turn"] button *,
        article[data-testid*="conversation-turn"] svg {
          color: revert !important;
        }
      `;
    }
  };
}

export const chatgptAdapter = createChatGPTAdapter();
