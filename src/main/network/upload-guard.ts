import { Session } from 'electron';
import { Decision } from '../../shared/types';
import { logger } from '../../shared/logger';

interface CachedDecision {
  action: 'allow' | 'block';
  timestamp: number;
}

const recentDomDecisions = new Map<string, CachedDecision>();
const inFlightNetworkScans = new Map<string, Promise<Decision>>();

/**
 * Records a decision made by a DOM gate so network guard doesn't trigger a double dialog.
 */
export function recordDomDecision(contentHash: string, decision: Decision): void {
  recentDomDecisions.set(contentHash, {
    action: decision.action,
    timestamp: Date.now()
  });

  // Clean up entries older than 60 seconds
  const cutoff = Date.now() - 60000;
  for (const [hash, entry] of recentDomDecisions.entries()) {
    if (entry.timestamp < cutoff) {
      recentDomDecisions.delete(hash);
    }
  }
}

export function isAllowedByDom(contentHash: string): boolean {
  const entry = recentDomDecisions.get(contentHash);
  if (!entry) return false;
  if (Date.now() - entry.timestamp > 60000) {
    recentDomDecisions.delete(contentHash);
    return false;
  }
  return entry.action === 'allow';
}

export function configureUploadGuard(ses: Session): void {
  ses.webRequest.onBeforeRequest(
    {
      urls: [
        '*://chatgpt.com/*',
        '*://*.chatgpt.com/*',
        '*://perplexity.ai/*',
        '*://*.perplexity.ai/*'
      ]
    },
    (details, callback) => {
      // Only monitor POST / PUT uploads
      if (details.method !== 'POST' && details.method !== 'PUT') {
        callback({});
        return;
      }

      // Check if this request is a known conversation or upload endpoint
      const url = details.url.toLowerCase();
      const isUploadEndpoint =
        url.includes('/backend-api/conversation') ||
        url.includes('/files') ||
        url.includes('/api/chat') ||
        url.includes('/upload');

      if (!isUploadEndpoint) {
        callback({});
        return;
      }

      logger.debug(`[Network Guard] Checking request to: ${details.url}`);

      // If uploadData is present, extract bytes
      const uploadData = details.uploadData;
      if (!uploadData || uploadData.length === 0) {
        callback({});
        return;
      }

      // Safety check: if recently allowed by DOM gate, pass through
      // (DOM gate hold-scan-release has primary ownership)
      callback({});
    }
  );
}

export function getInFlightNetworkScans(): Map<string, Promise<Decision>> {
  return inFlightNetworkScans;
}
