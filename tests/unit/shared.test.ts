import { describe, it, expect } from 'vitest';
import { validateScanRequest, validateSettings } from '../../src/shared/schema';
import { findAdapterByHostname } from '../../src/sites/registry';
import { chatgptAdapter } from '../../src/sites/chatgpt';
import { perplexityAdapter } from '../../src/sites/perplexity';
import { DEFAULT_MARKER } from '../../src/shared/constants';

describe('Shared Schemas & Validation', () => {
  it('validates a correct prompt scan request', () => {
    const res = validateScanRequest({
      site: 'chatgpt',
      kind: 'prompt',
      data: 'Hello WALLED_SENSITIVE world'
    });
    expect(res.valid).toBe(true);
  });

  it('rejects an invalid site in scan request', () => {
    const res = validateScanRequest({
      site: 'claude',
      kind: 'prompt',
      data: 'test'
    });
    expect(res.valid).toBe(false);
  });

  it('validates settings payload', () => {
    const res = validateSettings({
      markers: [DEFAULT_MARKER],
      responseColor: '#00A86B',
      failClosed: true,
      snippetLogging: false,
      maxFileSizeBytes: 52428800,
      retentionDays: 90
    });
    expect(res.valid).toBe(true);
  });
});

describe('Site Adapters', () => {
  it('resolves chatgpt.com to chatgpt adapter', () => {
    const adapter = findAdapterByHostname('chatgpt.com');
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe('chatgpt');
  });

  it('resolves www.perplexity.ai to perplexity adapter', () => {
    const adapter = findAdapterByHostname('www.perplexity.ai');
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe('perplexity');
  });

  it('generates response CSS containing the specified color', () => {
    const css = chatgptAdapter.responseCss('#00A86B');
    expect(css).toContain('#00A86B');
    expect(css).toContain('!important');

    const pplxCss = perplexityAdapter.responseCss('#FF0000');
    expect(pplxCss).toContain('#FF0000');
  });
});
