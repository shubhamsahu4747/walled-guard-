import crypto from 'crypto';
import { ScanRequest, ScanVerdict } from '../shared/types';
import { DEFAULT_MARKER, MAX_FILE_SIZE_BYTES, SCAN_TIMEOUT_MS } from '../shared/constants';
import { verdictCache } from './cache';
import { createSingleFlight } from './single-flight';
import { sniffFileType } from './sniff';
import { scanTextContent } from './extractors/text';
import { matchRawBytes } from './matcher/streaming';
import { scanPdfContent } from './extractors/pdf';
import { scanImageBuffer } from './extractors/image';

const singleFlight = createSingleFlight<ScanVerdict>();

/**
 * Computes SHA-256 hash of prompt string or file buffer.
 */
export function computeContentHash(data: string | Uint8Array | ArrayBuffer): string {
  const hash = crypto.createHash('sha256');
  if (typeof data === 'string') {
    hash.update(data, 'utf8');
  } else if (data instanceof Uint8Array) {
    hash.update(data);
  } else {
    hash.update(new Uint8Array(data));
  }
  return hash.digest('hex');
}

/**
 * Converts input data to Uint8Array.
 */
function toUint8Array(data: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array(data);
}

/**
 * Orchestrates scanning with:
 * - Content hashing
 * - Verdict caching (caching verdicts, never decisions)
 * - Single-flight request coalescing
 * - File size capping
 * - Timeout fail-closed enforcement
 */
export async function scan(
  req: ScanRequest,
  markers: string[] = [DEFAULT_MARKER]
): Promise<ScanVerdict> {
  const startTime = Date.now();
  const bytes = toUint8Array(req.data);

  // 1. File size cap check (Fail-closed if exceeded)
  if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      found: false,
      failed: true,
      failReason: `File size (${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB) exceeds 50 MB limit`,
      ms: Date.now() - startTime
    };
  }

  // 2. Compute SHA-256 hash
  const hash = computeContentHash(bytes);

  // 3. Check Verdict Cache (TTL 5 mins)
  const cached = verdictCache.get(hash);
  if (cached) {
    return {
      ...cached,
      ms: Date.now() - startTime
    };
  }

  // 4. Single-flight execution
  return singleFlight.do(hash, async () => {
    // Wrap with timeout promise (Fail closed)
    const timeoutPromise = new Promise<ScanVerdict>((resolve) => {
      setTimeout(() => {
        resolve({
          found: false,
          failed: true,
          failReason: `Scan timed out after ${SCAN_TIMEOUT_MS / 1000} seconds`,
          ms: Date.now() - startTime
        });
      }, SCAN_TIMEOUT_MS);
    });

    const executionPromise = (async (): Promise<ScanVerdict> => {
      // 5. Route by content kind / sniffed type
      if (req.kind === 'prompt' || typeof req.data === 'string') {
        const text = typeof req.data === 'string' ? req.data : new TextDecoder().decode(bytes);
        return scanTextContent(text, markers, startTime);
      }

      // Sniff file type by magic bytes
      const sniffedType = sniffFileType(bytes);

      if (sniffedType === 'text') {
        const textVerdict = scanTextContent(new TextDecoder().decode(bytes), markers, startTime);
        if (textVerdict.found) return textVerdict;

        // Byte pattern check (UTF-16LE, UTF-16BE)
        for (const marker of markers) {
          if (matchRawBytes(bytes, marker)) {
            return {
              found: true,
              source: 'plain-text',
              ms: Date.now() - startTime
            };
          }
        }
        return textVerdict;
      }

      if (sniffedType === 'pdf') {
        return await scanPdfContent(bytes, markers, startTime);
      }

      if (sniffedType === 'image') {
        return await scanImageBuffer(bytes, markers, startTime);
      }

      // Unsupported or unreadable file: fail-closed path
      return {
        found: false,
        failed: true,
        failReason: 'Unsupported or unreadable file type',
        ms: Date.now() - startTime
      };
    })();

    const verdict = await Promise.race([executionPromise, timeoutPromise]);

    // Cache the verdict (never the user's decision)
    if (!verdict.failed) {
      verdictCache.set(hash, verdict);
    }

    return verdict;
  });
}
