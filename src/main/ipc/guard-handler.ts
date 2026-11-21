import { ipcMain, BaseWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { validateScanRequest } from '../../shared/schema';
import { Decision, ScanRequest, ScanVerdict } from '../../shared/types';
import { scan } from '../../scanner';
import { showConfirmDialog } from '../dialog/confirm-dialog';
import { getSettings } from './settings-handler';
import { logger } from '../../shared/logger';

export function registerGuardHandler(getParentWindow: () => BaseWindow | null): void {
  // Main scan channel
  ipcMain.handle(IPC_CHANNELS.GUARD_SCAN, async (_event, rawReq: unknown): Promise<Decision> => {
    const validated = validateScanRequest(rawReq);
    if (!validated.valid) {
      logger.warn(`Rejected invalid scan request: ${validated.error}`);
      return { action: 'block', reason: 'scan_failed' };
    }

    const req = validated.data;
    const settings = getSettings();
    logger.info(`Received scan request for [${req.kind}] from [${req.site}]`);

    const verdict = await scan(req, settings.markers);

    // Clean content passes immediately without dialog
    if (!verdict.found && !verdict.failed) {
      return { action: 'allow', reason: 'clean' };
    }

    // If scan failed but failClosed is explicitly disabled
    if (verdict.failed && !settings.failClosed) {
      logger.warn('Scan failed but failClosed is off; allowing action');
      return { action: 'allow', reason: 'clean' };
    }

    // Trigger native dialog
    const win = getParentWindow();
    return await showConfirmDialog(win, req, verdict);
  });

  // Dev-only debug channel to trigger dialog with simulated inputs
  ipcMain.handle(
    IPC_CHANNELS.GUARD_DEBUG_DIALOG,
    async (_event, variant: 'prompt' | 'file' | 'failed'): Promise<Decision> => {
      logger.info(`[Debug] Triggering debug dialog variant: ${variant}`);
      const win = getParentWindow();

      if (variant === 'failed') {
        const fakeReq: ScanRequest = {
          site: 'perplexity',
          kind: 'file',
          name: 'scan-contract.pdf',
          data: 'dummy'
        };
        const fakeVerdict: ScanVerdict = {
          found: false,
          failed: true,
          failReason: 'password-protected PDF',
          ms: 100
        };
        return await showConfirmDialog(win, fakeReq, fakeVerdict);
      }

      if (variant === 'file') {
        const fakeReq: ScanRequest = {
          site: 'chatgpt',
          kind: 'file',
          name: 'Q3-board-notes.pdf',
          mime: 'application/pdf',
          data: 'dummy'
        };
        const fakeVerdict: ScanVerdict = {
          found: true,
          source: 'ocr',
          location: 'page 3',
          ms: 2400
        };
        return await showConfirmDialog(win, fakeReq, fakeVerdict);
      }

      // Default: Prompt variant
      const fakeReq: ScanRequest = {
        site: 'perplexity',
        kind: 'prompt',
        data: 'Summarise the Q3 numbers WALLED_SENSITIVE budget by team and projected growth'
      };
      const fakeVerdict: ScanVerdict = {
        found: true,
        source: 'plain-text',
        ms: 4
      };
      return await showConfirmDialog(win, fakeReq, fakeVerdict);
    }
  );
}
