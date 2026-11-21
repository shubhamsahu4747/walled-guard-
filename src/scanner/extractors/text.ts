import { ScanVerdict } from '../../shared/types';
import { normalizeText } from '../matcher/normalize';
import { matchInStream } from '../matcher/streaming';

export function scanTextContent(
  text: string,
  markers: string[],
  startTime: number
): ScanVerdict {
  if (!text) {
    return { found: false, ms: Date.now() - startTime };
  }

  // 1. Direct fast-path check
  for (const marker of markers) {
    if (text.includes(marker)) {
      return {
        found: true,
        source: 'plain-text',
        ms: Date.now() - startTime
      };
    }
  }

  // 2. Normalized check (NFKC, zero-width character stripping, uppercase)
  const normText = normalizeText(text);
  for (const marker of markers) {
    const normMarker = normalizeText(marker);
    if (normText.includes(normMarker)) {
      return {
        found: true,
        source: 'plain-text',
        ms: Date.now() - startTime
      };
    }
  }

  // 3. Chunked streaming match (if very long text or split lines)
  if (text.length > 50000) {
    const chunks = (function* () {
      const chunkSize = 16384;
      for (let i = 0; i < text.length; i += chunkSize) {
        yield text.slice(i, i + chunkSize);
      }
    })();

    for (const marker of markers) {
      if (matchInStream(chunks, marker)) {
        return {
          found: true,
          source: 'plain-text',
          ms: Date.now() - startTime
        };
      }
    }
  }

  return {
    found: false,
    ms: Date.now() - startTime
  };
}
