import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { scan } from '../../src/scanner';
import { buildDialogOptions } from '../../src/main/dialog/confirm-dialog';
import { chatgptAdapter } from '../../src/sites/chatgpt';
import { perplexityAdapter } from '../../src/sites/perplexity';
import { createGateStateManager } from '../../src/preload/gates/gate-state';
import { ScanRequest } from '../../src/shared/types';

const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Full Acceptance Matrix Verification (A1 - A10 & Edge Cases)', () => {
  // A1: Prompt without marker -> Sent, no dialog
  it('A1: Clean prompt submits immediately without dialog', async () => {
    const req: ScanRequest = {
      site: 'chatgpt',
      kind: 'prompt',
      data: 'What are the main principles of functional programming?'
    };
    const verdict = await scan(req);
    expect(verdict.found).toBe(false);
    expect(verdict.failed).toBeUndefined();
    expect(verdict.ms).toBeLessThan(50);
  });

  // A2: Prompt with marker -> Native dialog triggered
  it('A2: Prompt with marker triggers dialog with snippet and site', async () => {
    const req: ScanRequest = {
      site: 'perplexity',
      kind: 'prompt',
      data: 'Please summarize our WALLED_SENSITIVE project roadmap'
    };
    const verdict = await scan(req);
    expect(verdict.found).toBe(true);

    const dialogOpts = buildDialogOptions(req, verdict);
    expect(dialogOpts.title).toBe('Sensitive content detected');
    expect(dialogOpts.message).toBe('Sensitive marker found in a text prompt');
    expect(dialogOpts.detail).toContain('perplexity.ai');
    expect(dialogOpts.detail).toContain('WALLED_SENSITIVE');
    expect(dialogOpts.defaultId).toBe(1); // Cancel default
  });

  // A3: .txt with marker -> Native dialog before upload
  it('A3: Text file with marker triggers dialog before upload', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked.txt'));
    const req: ScanRequest = {
      site: 'chatgpt',
      kind: 'file',
      name: 'marked.txt',
      data
    };
    const verdict = await scan(req);
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('plain-text');

    const dialogOpts = buildDialogOptions(req, verdict);
    expect(dialogOpts.message).toContain('Sensitive marker found in a file (text)');
  });

  // A4: PDF with marker (text layer) -> Native dialog before upload
  it('A4: PDF with text layer marker triggers dialog before upload', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked-text-layer.pdf'));
    const req: ScanRequest = {
      site: 'chatgpt',
      kind: 'file',
      name: 'marked-text-layer.pdf',
      data
    };
    const verdict = await scan(req);
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('text-layer');

    const dialogOpts = buildDialogOptions(req, verdict);
    expect(dialogOpts.message).toContain('Sensitive marker found in a file (PDF)');
  });

  // A5: Image with marker -> Native dialog before upload
  it('A5: Image with marker triggers dialog via OCR before upload', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked.png'));
    const req: ScanRequest = {
      site: 'perplexity',
      kind: 'file',
      name: 'marked.png',
      data
    };
    const verdict = await scan(req);
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('ocr');

    const dialogOpts = buildDialogOptions(req, verdict);
    expect(dialogOpts.message).toContain('Sensitive marker found in a file (image)');
    expect(dialogOpts.detail).toContain('Found using OCR.');
  });

  // A6 & A7: Continue vs Cancel
  it('A6 & A7: Cancel blocks action; Continue allows replay untouched', () => {
    const gateState = createGateStateManager();
    const event = { type: 'submit' };

    // Initially not bypassed
    expect(gateState.isBypassed(event)).toBe(false);

    // Cancel: status becomes BLOCKED, bypass is NOT granted
    gateState.setStatus('BLOCKED');
    expect(gateState.getStatus()).toBe('BLOCKED');
    expect(gateState.isBypassed(event)).toBe(false);

    // Continue: status becomes RELEASED, one-shot bypass is granted
    gateState.setStatus('RELEASED');
    gateState.markBypassed(event);
    expect(gateState.isBypassed(event)).toBe(true);

    // After replay, bypass is consumed
    gateState.clearBypass(event);
    expect(gateState.isBypassed(event)).toBe(false);
  });

  // A8: ChatGPT response colour
  it('A8: ChatGPT responses recolored with code block preservation', () => {
    const css = chatgptAdapter.responseCss('#00A86B');
    expect(css).toContain('[data-message-author-role="assistant"]');
    expect(css).toContain('#00A86B !important');
    expect(css).toContain('pre');
    expect(css).toContain('code');
    expect(css).toContain('revert !important');
  });

  // A9: Perplexity response colour
  it('A9: Perplexity responses recolored with code block preservation', () => {
    const css = perplexityAdapter.responseCss('#00A86B');
    expect(css).toContain('[data-testid="answer-content"]');
    expect(css).toContain('.prose');
    expect(css).toContain('#00A86B !important');
    expect(css).toContain('revert !important');
  });

  // A10: Clean file -> Uploaded without dialog
  it('A10: Clean file uploaded without dialog', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'clean.png'));
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'clean.png',
      data
    });
    expect(verdict.found).toBe(false);
    expect(verdict.failed).toBeUndefined();
  });

  // Edge Case E1: Same file re-upload after Cancel triggers dialog again (R4.3)
  it('E1: Re-upload of same file after cancel triggers dialog again (Verdict cache only)', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked.txt'));
    const req: ScanRequest = {
      site: 'chatgpt',
      kind: 'file',
      name: 'marked.txt',
      data
    };

    // First scan
    const verdict1 = await scan(req);
    expect(verdict1.found).toBe(true);

    // Second scan (re-upload retry after cancel)
    const verdict2 = await scan(req);
    expect(verdict2.found).toBe(true); // Still flags sensitive!
  });

  // Edge Case E2: Case insensitivity
  it('E2: Marker in mixed/lower case is detected', async () => {
    const verdict = await scan({
      site: 'perplexity',
      kind: 'prompt',
      data: 'Notice this wAlLeD_sEnSiTiVe text'
    });
    expect(verdict.found).toBe(true);
  });

  // Edge Case E3: Hidden zero-width characters
  it('E3: Marker with embedded zero-width spaces is detected', async () => {
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'prompt',
      data: 'Hidden W\u200BAL\u200CL\u200DED_\uFEFFSENSITIVE payload'
    });
    expect(verdict.found).toBe(true);
  });
});
