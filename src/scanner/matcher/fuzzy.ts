import { stripNonAlphaNumeric } from './normalize';

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }

  return dp[b.length];
}

/**
 * OCR-tolerant matching:
 * 1. Strips all non-alphanumerics and checks for exact substring.
 * 2. Sliding window check with Levenshtein distance <= maxDistance (default 1).
 */
export function fuzzyMatchOCR(
  rawText: string,
  marker: string,
  maxDistance = 1
): boolean {
  const strippedText = stripNonAlphaNumeric(rawText);
  const strippedMarker = stripNonAlphaNumeric(marker);

  if (!strippedText || !strippedMarker) return false;

  // 1. Fast path: stripped substring match
  if (strippedText.includes(strippedMarker)) {
    return true;
  }

  // 2. Sliding window with Levenshtein tolerance
  const markerLen = strippedMarker.length;
  const minLen = Math.max(1, markerLen - maxDistance);
  const maxLen = markerLen + maxDistance;

  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i <= strippedText.length - len; i++) {
      const windowStr = strippedText.slice(i, i + len);
      if (levenshteinDistance(windowStr, strippedMarker) <= maxDistance) {
        return true;
      }
    }
  }

  return false;
}
