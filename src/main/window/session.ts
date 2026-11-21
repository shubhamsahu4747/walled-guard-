import { session, Session } from 'electron';
import { PERSISTENT_PARTITION, DEFAULT_USER_AGENT } from '../../shared/constants';
import { logger } from '../../shared/logger';

export function configureWebSession(): Session {
  const ses = session.fromPartition(PERSISTENT_PARTITION);
  ses.setUserAgent(DEFAULT_USER_AGENT);

  // 1. Permission request handler: Block non-essential sensor/hardware permissions
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    logger.debug(`[Security] Permission requested: ${permission} from ${webContents.getURL()}`);
    // Block sensitive hardware access
    if (
      permission === 'geolocation' ||
      permission === 'media' ||
      permission === 'notifications' ||
      permission === 'midi' ||
      permission === 'openExternal'
    ) {
      callback(false);
      return;
    }
    // Allow standard web features for AI chat (e.g. clipboard reading if requested by webview)
    callback(true);
  });

  // 2. Strict Content Security Policy for local renderer views
  ses.webRequest.onHeadersReceived((details, callback) => {
    const isLocalRenderer = details.url.startsWith('file://') && details.url.includes('/renderer/');
    if (isLocalRenderer) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self';"
          ]
        }
      });
      return;
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  return ses;
}
