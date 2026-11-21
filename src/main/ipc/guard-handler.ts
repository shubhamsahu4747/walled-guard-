import { ipcMain, BaseWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { validateScanRequest } from '../../shared/schema';
import { Decision, ScanRequest, ScanVerdict, FileType } from '../../shared/types';
import { scan, computeContentHash } from '../../scanner';
import { showConfirmDialog } from '../dialog/confirm-dialog';
import { getSettings } from './settings-handler';
import { logEvent } from '../store/db';
import { logger } from '../../shared/logger';

function inferFileType(name?: string, mime?: string): FileType | null {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (n.endsWith('.pdf') || m.includes('pdf')) return 'pdf';
  if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || m.includes('image')) return 'image';
  if (n.endsWith('.txt') || m.includes('text')) return 'text';
  return null;
}

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
    const contentHash = computeContentHash(req.data);
    const sizeBytes = typeof req.data === 'string'
      ? Buffer.byteLength(req.data, 'utf8')
      : req.data instanceof Uint8Array
        ? req.data.byteLength
        : req.data.byteLength;

    logger.info(`Received scan request for [${req.kind}] from [${req.site}] (hash: ${contentHash.slice(0, 8)})`);

    const verdict = await scan(req, settings.markers);

    let decision: Decision;

    // Clean content passes immediately without dialog
    if (!verdict.found && !verdict.failed) {
      decision = { action: 'allow', reason: 'clean' };
    } else if (verdict.failed && !settings.failClosed) {
      // If scan failed but failClosed is explicitly disabled
      logger.warn('Scan failed but failClosed is off; allowing action');
      decision = { action: 'allow', reason: 'clean' };
    } else {
      // Trigger native dialog
      const win = getParentWindow();
      decision = await showConfirmDialog(win, req, verdict);
    }

    // Snippet logging is strictly opt-in and capped to 80 chars (Privacy P1)
    let snippet: string | null = null;
    if (settings.snippetLogging && typeof req.data === 'string') {
      snippet = req.data.slice(0, 80);
    }

    // Fire-and-forget logging to bounded write-behind queue (never blocks decision)
    logEvent({
      ts: new Date(),
      site: req.site,
      kind: req.kind,
      fileType: req.kind === 'file' ? inferFileType(req.name, req.mime) : null,
      fileName: req.kind === 'file' ? req.name || 'unnamed' : null,
      sizeBytes,
      detected: verdict.found,
      detectionSource: verdict.source || null,
      decision: decision.reason,
      scanMs: verdict.ms,
      contentHash,
      snippet
    });

    return decision;
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
