import { ipcMain, BaseWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { validateScanRequest } from '../../shared/schema';
import { Decision } from '../../shared/types';
import { scan } from '../../scanner';
import { showConfirmDialog } from '../dialog/confirm-dialog';
import { logger } from '../../shared/logger';

export function registerGuardHandler(getParentWindow: () => BaseWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.GUARD_SCAN, async (_event, rawReq: unknown): Promise<Decision> => {
    const validated = validateScanRequest(rawReq);
    if (!validated.valid) {
      logger.warn(`Rejected invalid scan request: ${validated.error}`);
      return { action: 'block', reason: 'scan_failed' };
    }

    const req = validated.data;
    logger.info(`Received scan request for [${req.kind}] from [${req.site}]`);

    const verdict = await scan(req);

    if (!verdict.found && !verdict.failed) {
      // Clean content passes immediately without dialog
      return { action: 'allow', reason: 'clean' };
    }

    // Sensitive content or failed scan: trigger native dialog
    const win = getParentWindow();
    return await showConfirmDialog(win, req, verdict);
  });
}
