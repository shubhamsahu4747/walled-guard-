import { SiteAdapter } from './types';

export function createChatGPTAdapter(): SiteAdapter {
  return {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    selectors: {
      editor: [
        '#prompt-textarea',
        'textarea[placeholder*="Ask"]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[data-testid="fruitjuice-send-button"]',
        'button[aria-label*="Send"]',
        'form button'
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
    getPromptText(root = document): string {
      for (const sel of this.selectors.editor) {
        const el = root.querySelector(sel);
        if (el) {
          const anyEl = el as unknown as Record<string, unknown>;
          if (typeof anyEl.value === 'string') {
            return anyEl.value;
          }
          if (typeof anyEl.innerText === 'string') {
            return anyEl.innerText;
          }
          if (typeof anyEl.textContent === 'string') {
            return anyEl.textContent;
          }
        }
      }
      return '';
    },
    responseCss(color: string): string {
      return `
        /* ChatGPT AI response text recoloring (R5.1 - R5.4) */
        [data-message-author-role="assistant"],
        div[data-testid="conversation-turn-agent"],
        .agent-turn {
          color: ${color} !important;
        }
        [data-message-author-role="assistant"] p,
        [data-message-author-role="assistant"] li,
        [data-message-author-role="assistant"] span:not([class*="token"]) {
          color: inherit !important;
        }
        /* Exclude code blocks, syntax highlight tokens, links, and tables for complete readability (R5.4) */
        [data-message-author-role="assistant"] pre,
        [data-message-author-role="assistant"] pre *,
        [data-message-author-role="assistant"] code,
        [data-message-author-role="assistant"] code *,
        [data-message-author-role="assistant"] a,
        [data-message-author-role="assistant"] a *,
        [data-message-author-role="assistant"] table,
        [data-message-author-role="assistant"] table * {
          color: revert !important;
        }
      `;
    }
  };
}

export const chatgptAdapter = createChatGPTAdapter();
