import { SiteAdapter } from './types';

function extractText(el: unknown): string {
  if (!el || typeof el !== 'object') return '';
  const anyEl = el as Record<string, unknown>;

  // Check .value (inputs, textareas)
  if (typeof anyEl.value === 'string' && anyEl.value.trim().length > 0) {
    return anyEl.value.trim();
  }

  // Check .innerText (contenteditable divs)
  if (typeof anyEl.innerText === 'string' && anyEl.innerText.trim().length > 0) {
    return anyEl.innerText.trim();
  }

  // Check .textContent
  if (typeof anyEl.textContent === 'string' && anyEl.textContent.trim().length > 0) {
    return anyEl.textContent.trim();
  }

  return '';
}

export function createPerplexityAdapter(): SiteAdapter {
  return {
    id: 'perplexity',
    name: 'Perplexity',
    hosts: ['perplexity.ai', 'www.perplexity.ai'],
    selectors: {
      editor: [
        'div[contenteditable="true"]',
        'textarea[placeholder*="Ask" i]',
        'textarea',
        '[role="textbox"]',
        '#ask-input'
      ],
      sendButton: [
        'button[aria-label*="Submit" i]',
        'button[aria-label*="Ask" i]',
        'button[aria-label*="Send" i]',
        'button[type="submit"]'
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
    getPromptText(root = document, target?: Element | null): string {
      // 1. Try target
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
        /* Perplexity AI response text recoloring (R5.1 - R5.4) */
        [data-testid="answer-content"],
        .prose.dark\\:prose-invert,
        .prose {
          --text-primary: ${color} !important;
          color: ${color} !important;
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
          color: ${color} !important;
        }
        /* Exclude code blocks, syntax highlight tokens, links, and tables for complete readability (R5.4) */
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
    }
  };
}

export const perplexityAdapter = createPerplexityAdapter();
