import { ScanVerdict } from '../shared/types';
import { VERDICT_CACHE_TTL_MS } from '../shared/constants';

interface CacheEntry {
  verdict: ScanVerdict;
  expiresAt: number;
}

export interface VerdictCache {
  get: (hash: string) => ScanVerdict | null;
  set: (hash: string, verdict: ScanVerdict) => void;
  clear: () => void;
  size: () => number;
}

export function createVerdictCache(
  maxEntries = 500,
  ttlMs = VERDICT_CACHE_TTL_MS
): VerdictCache {
  const map = new Map<string, CacheEntry>();

  function get(hash: string): ScanVerdict | null {
    const entry = map.get(hash);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      map.delete(hash);
      return null;
    }

    // Move to most recently used (delete and re-insert)
    map.delete(hash);
    map.set(hash, entry);

    return entry.verdict;
  }

  function set(hash: string, verdict: ScanVerdict): void {
    if (map.has(hash)) {
      map.delete(hash);
    } else if (map.size >= maxEntries) {
      // Evict oldest (first key in map)
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) {
        map.delete(oldestKey);
      }
    }

    map.set(hash, {
      verdict,
      expiresAt: Date.now() + ttlMs
    });
  }

  function clear(): void {
    map.clear();
  }

  function size(): number {
    return map.size;
  }

  return { get, set, clear, size };
}

export const verdictCache = createVerdictCache();
