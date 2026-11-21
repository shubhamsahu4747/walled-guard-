import { dialog, BaseWindow, MessageBoxOptions } from 'electron';
import { Decision, ScanVerdict, ScanRequest } from '../../shared/types';
import { logger } from '../../shared/logger';

export async function showConfirmDialog(
  parentWindow: BaseWindow | null,
  req: ScanRequest,
  verdict: ScanVerdict
): Promise<Decision> {
  const isFailed = verdict.failed === true;

  let title = 'Sensitive content detected';
  let message = '';
  let detail = '';

  if (isFailed) {
    title = 'Could not scan this file';
    message = 'This file could not be scanned';
    detail = `Name: ${req.name || 'unnamed'}\nReason: ${verdict.failReason || 'unknown scan error'}.\nSite: ${req.site}\n\nContinue only if you trust this file.`;
  } else if (req.kind === 'prompt') {
    title = 'Sensitive content detected';
    message = 'Sensitive marker found in a text prompt';
    const snippet = typeof req.data === 'string' ? req.data.slice(0, 80) : '';
    detail = `Prompt: "${snippet}..."\nSite: ${req.site}\n\nContinue to send it, or Cancel to keep editing.`;
  } else {
    title = 'Sensitive content detected';
    const typeLabel = req.mime?.includes('pdf')
      ? 'PDF'
      : req.mime?.includes('image')
        ? 'Image'
        : 'file';
    message = `Sensitive marker found in a file (${typeLabel})`;
    const sourceLabel = verdict.source
      ? `\nFound via ${verdict.source}${verdict.location ? ' on ' + verdict.location : ''}.`
      : '';
    detail = `Name: ${req.name || 'uploaded file'}${sourceLabel}\nSite: ${req.site}\n\nContinue to upload this file, or Cancel to keep it from leaving this computer.`;
  }

  const options: MessageBoxOptions = {
    type: 'warning',
    title,
    message,
    detail,
    buttons: ['Continue', 'Cancel'],
    defaultId: 1, // Cancel is default
    cancelId: 1,  // Esc triggers Cancel
    noLink: true
  };

  logger.info(`Displaying native dialog for [${req.kind}] on [${req.site}]`);

  const result = parentWindow
    ? await dialog.showMessageBox(parentWindow, options)
    : await dialog.showMessageBox(options);

  if (result.response === 0) {
    logger.info(`User decision: CONTINUE for [${req.kind}]`);
    return { action: 'allow', reason: isFailed ? 'continued' : 'continued' };
  } else {
    logger.info(`User decision: CANCEL for [${req.kind}]`);
    return { action: 'block', reason: isFailed ? 'scan_failed' : 'cancelled' };
  }
}
