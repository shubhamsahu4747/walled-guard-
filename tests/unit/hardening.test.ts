import { describe, it, expect } from 'vitest';
import { scan } from '../../src/scanner';
import { recordDomDecision, isAllowedByDom } from '../../src/main/network/upload-guard';

describe('Phase 7 Hardening & Error Handling Pass (Fail-Closed)', () => {
  it('handles empty prompt string without error', async () => {
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'prompt',
      data: ''
    });
    expect(verdict.found).toBe(false);
    expect(verdict.failed).toBeUndefined();
  });

  it('handles empty 0-byte file without error', async () => {
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'empty.txt',
      data: new Uint8Array(0)
    });
    expect(verdict.found).toBe(false);
  });

  it('fails closed when file exceeds 50 MB limit', async () => {
    const largeBuffer = new Uint8Array(52 * 1024 * 1024);
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'archive.zip',
      data: largeBuffer
    });
    expect(verdict.failed).toBe(true);
    expect(verdict.failReason).toContain('exceeds 50 MB limit');
  });

  it('fails closed when processing corrupted PDF bytes', async () => {
    // Starts with %PDF but corrupted body
    const corruptedPdf = new TextEncoder().encode('%PDF-corrupted-binary-trash-###$$$%%%^^^&&&');
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'corrupted.pdf',
      data: corruptedPdf
    });
    expect(verdict.failed).toBe(true);
    expect(verdict.failReason).toBeDefined();
  });

  it('fails closed on corrupted image bytes with image header', async () => {
    // Starts with PNG magic bytes but corrupted truncated data
    const corruptedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'broken.png',
      data: corruptedPng
    });
    expect(verdict.failed).toBe(true);
    expect(verdict.failReason).toBeDefined();
  });

  it('caches DOM decisions in network upload guard for 60 seconds', () => {
    const hash = 'test_hash_123';
    expect(isAllowedByDom(hash)).toBe(false);

    recordDomDecision(hash, { action: 'allow', reason: 'continued' });
    expect(isAllowedByDom(hash)).toBe(true);

    const blockedHash = 'test_hash_blocked';
    recordDomDecision(blockedHash, { action: 'block', reason: 'cancelled' });
    expect(isAllowedByDom(blockedHash)).toBe(false);
  });
});
