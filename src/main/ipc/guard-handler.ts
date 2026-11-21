import { ipcMain, BaseWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { validateScanRequest } from '../../shared/schema';
import { Decision, ScanRequest, ScanVerdict, FileType } from '../../shared/types';
import { scan, computeContentHash } from '../../scanner';
import { showConfirmDialog } from '../dialog/confirm-dialog';
import { getSettings } from './settings-handler';
import { logEvent } from '../store/db';
import { recordDomDecision } from '../network/upload-guard';
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

    // Record DOM decision in network safety net cache
    recordDomDecision(contentHash, decision);

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
      source: req.source || 'app',
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
        // Allow user to select a real file to inspect
        try {
          const dialogOptions = {
            title: 'Select a file to inspect with Walled Guard DLP',
            properties: ['openFile'] as ('openFile')[],
            filters: [
              { name: 'Supported Files (*.txt, *.pdf, *.png, *.jpg)', extensions: ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'csv', 'json'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          };
          const openRes = win
            ? await dialog.showOpenDialog(win, dialogOptions)
            : await dialog.showOpenDialog(dialogOptions);

          if (!openRes.canceled && openRes.filePaths.length > 0) {
            const selectedPath = openRes.filePaths[0];
            const fileName = path.basename(selectedPath);
            const fileBytes = fs.readFileSync(selectedPath);
            const contentHash = computeContentHash(fileBytes);
            const settings = getSettings();

            const realReq: ScanRequest = {
              site: 'chatgpt',
              kind: 'file',
              source: 'app',
              name: fileName,
              data: fileBytes
            };

            const realVerdict = await scan(realReq, settings.markers);

            let decision: Decision;
            if (!realVerdict.found && !realVerdict.failed) {
              decision = { action: 'allow', reason: 'clean' };
              const cleanMsgOptions = {
                type: 'info' as const,
                title: 'File Clean',
                message: 'No sensitive marker detected',
                detail: `File: "${fileName}"\nScan time: ${realVerdict.ms} ms\nDecision: Approved (Clean)`,
                buttons: ['OK']
              };
              if (win) {
                await dialog.showMessageBox(win, cleanMsgOptions);
              } else {
                await dialog.showMessageBox(cleanMsgOptions);
              }
            } else {
              decision = await showConfirmDialog(win, realReq, realVerdict);
            }

            logEvent({
              ts: new Date(),
              site: 'chatgpt',
              kind: 'file',
              source: 'app',
              fileType: inferFileType(fileName),
              fileName,
              sizeBytes: fileBytes.length,
              detected: realVerdict.found,
              detectionSource: realVerdict.source || null,
              decision: decision.reason,
              scanMs: realVerdict.ms,
              contentHash,
              snippet: null
            });

            return decision;
          }
        } catch {
          logger.warn('Interactive file pick cancelled or failed, falling back to simulated dialog');
        }

        // Fallback simulation for automated tests or cancel
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
