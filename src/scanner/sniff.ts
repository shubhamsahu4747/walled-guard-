import { FileType } from '../shared/types';

export type SniffResult = FileType | 'unsupported';

/**
 * Sniffs the file type based on magic bytes.
 * Detects: PDF, PNG, JPEG, WebP, GIF, or plain text heuristic.
 */
export function sniffFileType(data: Uint8Array): SniffResult {
  if (data.length < 4) {
    return isLikelyText(data) ? 'text' : 'unsupported';
  }

  // 1. PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
    return 'pdf';
  }

  // 2. PNG: 0x89, 0x50, 0x4E, 0x47
  if (data.length >= 8 &&
      data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
      data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A) {
    return 'image';
  }

  // 3. JPEG: 0xFF, 0xD8, 0xFF
  if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image';
  }

  // 4. WebP: 'RIFF'....'WEBP'
  if (data.length >= 12 &&
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return 'image';
  }

  // 5. GIF: 'GIF87a' or 'GIF89a'
  if (data.length >= 6 &&
      data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38 &&
      (data[4] === 0x37 || data[4] === 0x39) && data[5] === 0x61) {
    return 'image';
  }

  // 6. Text heuristic
  if (isLikelyText(data)) {
    return 'text';
  }

  return 'unsupported';
}

/**
 * Heuristic to check whether a byte buffer contains valid readable text (UTF-8 / ASCII).
 */
export function isLikelyText(data: Uint8Array): boolean {
  if (data.length === 0) return true;

  // Check first 4096 bytes for binary / null characters
  const sampleSize = Math.min(data.length, 4096);
  let nullCount = 0;
  let controlCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = data[i];
    if (byte === 0x00) {
      nullCount++;
    } else if ((byte < 0x09 || (byte > 0x0D && byte < 0x20)) && byte !== 0x1B) {
      controlCount++;
    }
  }

  // If there are null bytes or > 10% non-whitespace control characters, it's binary
  if (nullCount > 0 || controlCount / sampleSize > 0.1) {
    return false;
  }

  return true;
}
