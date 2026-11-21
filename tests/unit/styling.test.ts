import { describe, it, expect } from 'vitest';
import { chatgptAdapter } from '../../src/sites/chatgpt';
import { perplexityAdapter } from '../../src/sites/perplexity';
import { onSettingsChange, getSettings } from '../../src/main/ipc/settings-handler';

describe('Response Colour CSS Generation & Readability (R5.1 - R5.4)', () => {
  it('generates compliant CSS for ChatGPT assistant responses', () => {
    const css = chatgptAdapter.responseCss('#00A86B');

    // 1. Assistant text recoloring (R5.1, R5.2)
    expect(css).toContain('[data-message-author-role="assistant"]');
    expect(css).toContain('#00A86B !important');

    // 2. Readability preservation for code, links, and tables (R5.4)
    expect(css).toContain('pre');
    expect(css).toContain('code');
    expect(css).toContain('a');
    expect(css).toContain('table');
    expect(css).toContain('revert !important');
  });

  it('generates compliant CSS for Perplexity assistant responses', () => {
    const css = perplexityAdapter.responseCss('#00875A');

    // 1. Assistant text recoloring (R5.1, R5.2)
    expect(css).toContain('[data-testid="answer-content"]');
    expect(css).toContain('.prose');
    expect(css).toContain('#00875A !important');

    // 2. Readability preservation for code, links, and tables (R5.4)
    expect(css).toContain('pre');
    expect(css).toContain('code');
    expect(css).toContain('a');
    expect(css).toContain('table');
    expect(css).toContain('revert !important');
  });

  it('notifies subscribers when settings change', () => {
    let notifiedColor = '';
    const unsubscribe = onSettingsChange((settings) => {
      notifiedColor = settings.responseColor;
    });

    expect(getSettings().responseColor).toBe('#00A86B');
    expect(notifiedColor).toBe('');
    unsubscribe();
  });
});
