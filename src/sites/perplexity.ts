import { SiteAdapter } from './types';

export function createPerplexityAdapter(): SiteAdapter {
  return {
    id: 'perplexity',
    name: 'Perplexity',
    hosts: ['perplexity.ai', 'www.perplexity.ai'],
    selectors: {
      editor: [
        'div[contenteditable="true"]',
        'textarea[placeholder*="Ask"]',
        'textarea',
        '[role="textbox"]'
      ],
      sendButton: [
        'button[aria-label*="Submit"]',
        'button[aria-label*="Search"]',
        'button[aria-label*="Ask"]',
        'button[type="submit"]',
        'form button'
      ],
      fileInput: [
        'input[type="file"]'
      ],
      dropZone: [
        'main',
        'textarea',
        'form',
        '[role="presentation"]'
      ],
      assistantMessage: [
        '[data-testid="answer-content"]',
        '.prose',
        '.default.font-sans.text-base'
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
        /* Perplexity AI response text recoloring */
        [data-testid="answer-content"],
        .prose.dark\\:prose-invert,
        .prose {
          color: ${color} !important;
        }
        [data-testid="answer-content"] p,
        [data-testid="answer-content"] span,
        [data-testid="answer-content"] li,
        .prose p,
        .prose span,
        .prose li {
          color: inherit !important;
        }
        /* Exclude code, pre, links, tables to keep readability */
        [data-testid="answer-content"] pre,
        [data-testid="answer-content"] code,
        [data-testid="answer-content"] a,
        [data-testid="answer-content"] table,
        .prose pre,
        .prose code,
        .prose a,
        .prose table {
          color: revert !important;
        }
      `;
    }
  };
}

export const perplexityAdapter = createPerplexityAdapter();
