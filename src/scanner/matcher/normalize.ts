// Unicode zero-width and invisible control characters regex
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u2060\u00AD]/g;

/**
 * Normalizes text for marker matching:
 * 1. NFKC normalization (canonical equivalence)
 * 2. Strips hidden zero-width and formatting characters
 * 3. Case-folds to uppercase
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH_REGEX, '')
    .toUpperCase();
}

/**
 * Strips all non-alphanumeric characters and converts to uppercase.
 * Useful for OCR output where punctuation or spaces might be inserted into words.
 */
export function stripNonAlphaNumeric(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}
