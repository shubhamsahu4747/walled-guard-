import { ScanRequest, ScanVerdict } from '../shared/types';
import { DEFAULT_MARKER } from '../shared/constants';

/**
 * Pure TypeScript scanner interface (no Electron imports).
 * Performs sniffing, extraction, and matching.
 */
export async function scan(req: ScanRequest, markers: string[] = [DEFAULT_MARKER]): Promise<ScanVerdict> {
  const start = Date.now();

  try {
    if (typeof req.data === 'string') {
      const text = req.data;
      for (const marker of markers) {
        if (text.includes(marker)) {
          return {
            found: true,
            source: 'plain-text',
            ms: Date.now() - start
          };
        }
      }
      return {
        found: false,
        ms: Date.now() - start
      };
    }

    // Binary file scanning (stubbed for Phase 1, implemented in Phase 2)
    return {
      found: false,
      ms: Date.now() - start
    };
  } catch (err: unknown) {
    return {
      found: false,
      failed: true,
      failReason: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start
    };
  }
}
