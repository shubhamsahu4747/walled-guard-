import { describe, it, expect } from 'vitest';
import { buildDialogOptions } from '../../src/main/dialog/confirm-dialog';
import { ScanRequest, ScanVerdict } from '../../src/shared/types';

describe('Native Dialog Options Builder (State Verification)', () => {
  it('builds Dialog State A: Text prompt detected', () => {
    const req: ScanRequest = {
      site: 'perplexity',
      kind: 'prompt',
      data: 'Summarise the Q3 numbers WALLED_SENSITIVE budget by team and projected growth'
    };
    const verdict: ScanVerdict = {
      found: true,
      source: 'plain-text',
      ms: 5
    };

    const options = buildDialogOptions(req, verdict);

    expect(options.title).toBe('Sensitive content detected');
    expect(options.message).toBe('Sensitive marker found in a text prompt');
    expect(options.detail).toContain('Prompt: "Summarise the Q3 numbers WALLED_SENSITIVE');
    expect(options.detail).toContain('Site: perplexity.ai');
    expect(options.detail).toContain('Continue to send it, or Cancel to keep editing.');
    expect(options.buttons).toEqual(['Continue', 'Cancel']);
    expect(options.defaultId).toBe(1); // Cancel is default!
    expect(options.cancelId).toBe(1);  // Esc triggers Cancel
  });

  it('builds Dialog State B: File detected (PDF with OCR)', () => {
    const req: ScanRequest = {
      site: 'chatgpt',
      kind: 'file',
      name: 'Q3-board-notes.pdf',
      mime: 'application/pdf',
      data: new Uint8Array([1, 2, 3])
    };
    const verdict: ScanVerdict = {
      found: true,
      source: 'ocr',
      location: 'page 3',
      ms: 2400
    };

    const options = buildDialogOptions(req, verdict);

    expect(options.title).toBe('Sensitive content detected');
    expect(options.message).toBe('Sensitive marker found in a file (PDF)');
    expect(options.detail).toContain('Name: Q3-board-notes.pdf');
    expect(options.detail).toContain('Found on page 3 using OCR.');
    expect(options.detail).toContain('Site: chatgpt.com');
    expect(options.detail).toContain('Continue to upload this file, or Cancel to keep it from leaving this computer.');
    expect(options.buttons).toEqual(['Continue', 'Cancel']);
    expect(options.defaultId).toBe(1);
    expect(options.cancelId).toBe(1);
  });

  it('builds Dialog State C: Scan failed (fail closed)', () => {
    const req: ScanRequest = {
      site: 'perplexity',
      kind: 'file',
      name: 'scan-contract.pdf',
      data: new Uint8Array([1, 2, 3])
    };
    const verdict: ScanVerdict = {
      found: false,
      failed: true,
      failReason: 'password-protected PDF',
      ms: 20000
    };

    const options = buildDialogOptions(req, verdict);

    expect(options.title).toBe('Could not scan this file');
    expect(options.message).toBe('This file could not be scanned');
    expect(options.detail).toContain('Name: scan-contract.pdf');
    expect(options.detail).toContain('Reason: password-protected PDF.');
    expect(options.detail).toContain('Site: perplexity.ai');
    expect(options.detail).toContain('Continue only if you trust this file.');
    expect(options.buttons).toEqual(['Continue', 'Cancel']);
    expect(options.defaultId).toBe(1);
    expect(options.cancelId).toBe(1);
  });
});
