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
          if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
            return el.value || '';
          }
          if (el instanceof HTMLElement && el.isContentEditable) {
            return el.innerText || el.textContent || '';
          }
        }
      }
      return '';
    },
    responseCss(color: string): string {
      return `
        /* ChatGPT AI response text recoloring */
        [data-message-author-role="assistant"],
        div[data-testid="conversation-turn-agent"],
        .agent-turn {
          color: ${color} !important;
        }
        [data-message-author-role="assistant"] p,
        [data-message-author-role="assistant"] li,
        [data-message-author-role="assistant"] span {
          color: inherit !important;
        }
        /* Exclude code, pre, links, tables to keep readability */
        [data-message-author-role="assistant"] pre,
        [data-message-author-role="assistant"] code,
        [data-message-author-role="assistant"] a,
        [data-message-author-role="assistant"] table {
          color: revert !important;
        }
      `;
    }
  };
}

export const chatgptAdapter = createChatGPTAdapter();
