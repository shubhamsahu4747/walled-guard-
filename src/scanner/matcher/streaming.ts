import { normalizeText } from './normalize';

export interface StreamMatchOptions {
  overlapLength?: number;
}

/**
 * Scans a sequence of text chunks for a marker with boundary overlap protection.
 * O(N) time complexity and O(1) extra memory.
 */
export function matchInStream(
  chunks: Iterable<string>,
  marker: string,
  options?: StreamMatchOptions
): boolean {
  const normMarker = normalizeText(marker);
  if (!normMarker) return false;

  const overlapLen = options?.overlapLength ?? normMarker.length - 1;
  let carryover = '';

  for (const chunk of chunks) {
    const combined = carryover + chunk;
    const normalized = normalizeText(combined);

    if (normalized.includes(normMarker)) {
      return true;
    }

    // Preserve the tail for boundary overlap
    if (combined.length > overlapLen) {
      carryover = combined.slice(-overlapLen);
    } else {
      carryover = combined;
    }
  }

  return false;
}

/**
 * Searches raw bytes for UTF-8, UTF-16LE, and UTF-16BE encodings of a marker.
 */
export function matchRawBytes(buffer: Uint8Array, marker: string): boolean {
  const normMarker = marker.toUpperCase();
  const markerUtf8 = new TextEncoder().encode(normMarker);

  // 1. Direct UTF-8 search
  if (findSubarray(buffer, markerUtf8)) {
    return true;
  }

  // 2. UTF-16LE byte pattern (e.g., 'W\0A\0L\0L\0...')
  const utf16le = new Uint8Array(normMarker.length * 2);
  for (let i = 0; i < normMarker.length; i++) {
    utf16le[i * 2] = normMarker.charCodeAt(i) & 0xff;
    utf16le[i * 2 + 1] = (normMarker.charCodeAt(i) >> 8) & 0xff;
  }
  if (findSubarray(buffer, utf16le)) {
    return true;
  }

  // 3. UTF-16BE byte pattern
  const utf16be = new Uint8Array(normMarker.length * 2);
  for (let i = 0; i < normMarker.length; i++) {
    utf16be[i * 2] = (normMarker.charCodeAt(i) >> 8) & 0xff;
    utf16be[i * 2 + 1] = normMarker.charCodeAt(i) & 0xff;
  }
  if (findSubarray(buffer, utf16be)) {
    return true;
  }

  return false;
}

function findSubarray(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;

  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return true;
  }

  return false;
}
