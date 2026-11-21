import { session, Session } from 'electron';
import { PERSISTENT_PARTITION, DEFAULT_USER_AGENT } from '../../shared/constants';
import { logger } from '../../shared/logger';

export function configureWebSession(): Session {
  const ses = session.fromPartition(PERSISTENT_PARTITION);
  ses.setUserAgent(DEFAULT_USER_AGENT);

  // Security: block unauthorized permission requests (geolocation, camera, microphone, etc.)
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    logger.debug(`Permission requested: ${permission} from ${webContents.getURL()}`);
    callback(false);
  });

  return ses;
}
