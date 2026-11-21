import { createWorker, Worker } from 'tesseract.js';
import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';
import { ScanVerdict } from '../../shared/types';
import { fuzzyMatchOCR } from '../matcher/fuzzy';
import { normalizeText, stripNonAlphaNumeric } from '../matcher/normalize';

let cachedWorker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (cachedWorker) {
    return cachedWorker;
  }

  // Check if offline traineddata exists in resources/tessdata (packaged or dev)
  const proc = process as unknown as { resourcesPath?: string };
  const resPath = proc.resourcesPath || '';
  const candidatePaths = [
    path.resolve(process.cwd(), 'resources/tessdata'),
    path.join(resPath, 'resources/tessdata'),
    path.join(resPath, 'tessdata')
  ];

  let resolvedPath: string | null = null;
  for (const p of candidatePaths) {
    if (p && fs.existsSync(path.join(p, 'eng.traineddata'))) {
      resolvedPath = p;
      break;
    }
  }

  const options: Record<string, unknown> = {};
  if (resolvedPath) {
    options.langPath = resolvedPath;
    options.cachePath = resolvedPath;
    options.gzip = false;
  }

  cachedWorker = await createWorker('eng', 1, options);
  return cachedWorker;
}

export async function preprocessImage(
  data: Uint8Array,
  invert = false
): Promise<Buffer> {
  const image = await Jimp.read(Buffer.from(data));

  // 1. Downscale if excessively large (caps max dimension to 2000px)
  const maxDim = 2000;
  if (image.width > maxDim || image.height > maxDim) {
    if (image.width > image.height) {
      image.resize({ w: maxDim });
    } else {
      image.resize({ h: maxDim });
    }
  }

  // 2. Convert to grayscale for contrast optimization
  image.greyscale();

  // 3. Optional inversion (for dark-mode screenshots)
  if (invert) {
    image.invert();
  }

  return await image.getBuffer('image/png');
}

export async function scanImageBuffer(
  data: Uint8Array,
  markers: string[],
  startTime: number
): Promise<ScanVerdict> {
  try {
    const worker = await getWorker();

    // Pass 1: Standard grayscale preprocessed image
    const pass1Buffer = await preprocessImage(data, false);
    const result1 = await worker.recognize(pass1Buffer);
    const text1 = result1.data.text || '';

    // Check exact & stripped matches
    const strippedText1 = stripNonAlphaNumeric(text1);
    for (const marker of markers) {
      const strippedMarker = stripNonAlphaNumeric(marker);
      if (strippedText1.includes(strippedMarker) || normalizeText(text1).includes(normalizeText(marker))) {
        return {
          found: true,
          source: 'ocr',
          ms: Date.now() - startTime
        };
      }
      if (fuzzyMatchOCR(text1, marker)) {
        return {
          found: true,
          source: 'fuzzy',
          ms: Date.now() - startTime
        };
      }
    }

    // Pass 2: Inverted image (dark mode screenshot optimization)
    const pass2Buffer = await preprocessImage(data, true);
    const result2 = await worker.recognize(pass2Buffer);
    const text2 = result2.data.text || '';

    const strippedText2 = stripNonAlphaNumeric(text2);
    for (const marker of markers) {
      const strippedMarker = stripNonAlphaNumeric(marker);
      if (strippedText2.includes(strippedMarker) || normalizeText(text2).includes(normalizeText(marker))) {
        return {
          found: true,
          source: 'ocr',
          ms: Date.now() - startTime
        };
      }
      if (fuzzyMatchOCR(text2, marker)) {
        return {
          found: true,
          source: 'fuzzy',
          ms: Date.now() - startTime
        };
      }
    }

    return {
      found: false,
      ms: Date.now() - startTime
    };
  } catch (err: unknown) {
    return {
      found: false,
      failed: true,
      failReason: err instanceof Error ? err.message : String(err),
      ms: Date.now() - startTime
    };
  }
}

export async function terminateImageWorker(): Promise<void> {
  if (cachedWorker) {
    await cachedWorker.terminate();
    cachedWorker = null;
  }
}
