import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalizeText, stripNonAlphaNumeric } from '../../src/scanner/matcher/normalize';
import { matchInStream, matchRawBytes } from '../../src/scanner/matcher/streaming';
import { fuzzyMatchOCR, levenshteinDistance } from '../../src/scanner/matcher/fuzzy';
import { sniffFileType } from '../../src/scanner/sniff';
import { createVerdictCache } from '../../src/scanner/cache';
import { scan } from '../../src/scanner';
import { terminateImageWorker } from '../../src/scanner/extractors/image';

const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Matcher - normalize', () => {
  it('strips zero-width characters and normalizes case', () => {
    const input = 'W\u200BAL\u200CL\u200DED_\uFEFFSENSITIVE';
    expect(normalizeText(input)).toBe('WALLED_SENSITIVE');
  });

  it('strips non-alphanumeric characters for OCR matching', () => {
    const input = 'W A L L E D _ S E N S I T I V E !';
    expect(stripNonAlphaNumeric(input)).toBe('WALLEDSENSITIVE');
  });
});

describe('Matcher - streaming & boundary overlap', () => {
  it('detects marker split exactly across chunk boundaries', () => {
    const chunks = ['Please check the WALLED_', 'SENSITIVE project document'];
    expect(matchInStream(chunks, 'WALLED_SENSITIVE')).toBe(true);
  });

  it('detects UTF-16LE byte pattern', () => {
    const marker = 'WALLED_SENSITIVE';
    // Create UTF-16LE buffer
    const buf = new Uint8Array(marker.length * 2);
    for (let i = 0; i < marker.length; i++) {
      buf[i * 2] = marker.charCodeAt(i);
      buf[i * 2 + 1] = 0;
    }
    expect(matchRawBytes(buf, marker)).toBe(true);
  });
});

describe('Matcher - fuzzy OCR', () => {
  it('calculates levenshtein distance correctly', () => {
    expect(levenshteinDistance('WALLED_SENSITIVE', 'WALLED_SENSITIVE')).toBe(0);
    expect(levenshteinDistance('WALLED_SENSIT1VE', 'WALLED_SENSITIVE')).toBe(1);
  });

  it('matches stripped OCR output', () => {
    expect(fuzzyMatchOCR('Found: WALLED SENSITIVE in scan', 'WALLED_SENSITIVE')).toBe(true);
  });

  it('matches OCR output with single character substitution', () => {
    expect(fuzzyMatchOCR('WALLED SENSIT1VE report', 'WALLED_SENSITIVE', 1)).toBe(true);
  });
});

describe('Sniffer - magic bytes', () => {
  it('identifies PDF by magic bytes', () => {
    const pdfBytes = fs.readFileSync(path.join(fixturesDir, 'clean.pdf'));
    expect(sniffFileType(pdfBytes)).toBe('pdf');
  });

  it('identifies PNG by magic bytes', () => {
    const pngBytes = fs.readFileSync(path.join(fixturesDir, 'clean.png'));
    expect(sniffFileType(pngBytes)).toBe('image');
  });

  it('identifies plain text via heuristic', () => {
    const txtBytes = fs.readFileSync(path.join(fixturesDir, 'clean.txt'));
    expect(sniffFileType(txtBytes)).toBe('text');
  });
});

describe('Verdict Cache', () => {
  it('caches and returns verdict with LRU eviction and TTL', () => {
    const cache = createVerdictCache(2, 5000);
    cache.set('hash1', { found: true, ms: 10 });
    cache.set('hash2', { found: false, ms: 5 });

    expect(cache.get('hash1')?.found).toBe(true);

    // Evicts oldest (hash2)
    cache.set('hash3', { found: true, ms: 12 });
    expect(cache.get('hash2')).toBeNull();
    expect(cache.get('hash1')).not.toBeNull();
    expect(cache.get('hash3')).not.toBeNull();
  });
});

describe('Scanner Orchestrator - Full Fixture Matrix', () => {
  afterAll(async () => {
    await terminateImageWorker();
  });

  it('scans a clean text prompt in under 50 ms', async () => {
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'prompt',
      data: 'Hello, what is the weather today?'
    });
    expect(verdict.found).toBe(false);
    expect(verdict.ms).toBeLessThan(50);
  });

  it('detects marker in sensitive prompt', async () => {
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'prompt',
      data: 'Summarise WALLED_SENSITIVE financial roadmap'
    });
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('plain-text');
  });

  it('scans clean.txt as clean', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'clean.txt'));
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'clean.txt',
      data
    });
    expect(verdict.found).toBe(false);
  });

  it('detects marker in marked.txt', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked.txt'));
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'marked.txt',
      data
    });
    expect(verdict.found).toBe(true);
  });

  it('detects marker with zero-width characters in marked-split.txt', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked-split.txt'));
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'marked-split.txt',
      data
    });
    expect(verdict.found).toBe(true);
  });

  it('scans clean.pdf as clean', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'clean.pdf'));
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'clean.pdf',
      data
    });
    expect(verdict.found).toBe(false);
  });

  it('detects marker in marked-text-layer.pdf', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked-text-layer.pdf'));
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'marked-text-layer.pdf',
      data
    });
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('text-layer');
  });

  it('scans clean.png as clean', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'clean.png'));
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'clean.png',
      data
    });
    expect(verdict.found).toBe(false);
  });

  it('detects marker in marked.png via OCR', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked.png'));
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'marked.png',
      data
    });
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('ocr');
  });

  it('detects marker in dark-mode marked-dark.png via inverted OCR pass', async () => {
    const data = fs.readFileSync(path.join(fixturesDir, 'marked-dark.png'));
    const verdict = await scan({
      site: 'perplexity',
      kind: 'file',
      name: 'marked-dark.png',
      data
    });
    expect(verdict.found).toBe(true);
    expect(verdict.source).toBe('ocr');
  });

  it('fails closed when file exceeds 50 MB limit', async () => {
    const fakeOversized = new Uint8Array(51 * 1024 * 1024);
    const verdict = await scan({
      site: 'chatgpt',
      kind: 'file',
      name: 'huge.bin',
      data: fakeOversized
    });
    expect(verdict.failed).toBe(true);
    expect(verdict.failReason).toContain('exceeds 50 MB limit');
  });
});
