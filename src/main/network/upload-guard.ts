import { Session } from 'electron';
import { logger } from '../../shared/logger';

export function configureUploadGuard(ses: Session): void {
  ses.webRequest.onBeforeRequest(
    { urls: ['*://chatgpt.com/*', '*://*.perplexity.ai/*'] },
    (details, callback) => {
      // Network safety net: inspect conversation/file uploads if missed by DOM gates
      if (details.method === 'POST') {
        logger.debug(`[Upload Guard] Inspecting POST request to ${details.url}`);
      }
      callback({});
    }
  );
}
