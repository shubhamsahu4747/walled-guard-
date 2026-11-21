import { dialog, BaseWindow, MessageBoxOptions } from 'electron';
import { Decision, ScanVerdict, ScanRequest, SiteId } from '../../shared/types';
import { logger } from '../../shared/logger';

function getSiteHost(site: SiteId): string {
  return site === 'chatgpt' ? 'chatgpt.com' : 'perplexity.ai';
}

function getFileTypeLabel(req: ScanRequest): string {
  const name = (req.name || '').toLowerCase();
  const mime = (req.mime || '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'PDF';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || mime.includes('image')) return 'image';
  if (name.endsWith('.txt') || mime.includes('text')) return 'text';
  return 'file';
}

function formatSourceLine(verdict: ScanVerdict): string {
  if (verdict.source === 'text-layer') {
    return verdict.location
      ? `Found on ${verdict.location} in text layer.`
      : 'Found via PDF text layer.';
  }
  if (verdict.source === 'ocr') {
    return verdict.location
      ? `Found on ${verdict.location} using OCR.`
      : 'Found using OCR.';
  }
  if (verdict.source === 'fuzzy') {
    return 'Found via OCR (fuzzy match).';
  }
  if (verdict.source === 'plain-text') {
    return 'Found via plain text.';
  }
  return '';
}

export function buildDialogOptions(req: ScanRequest, verdict: ScanVerdict): MessageBoxOptions {
  const isFailed = verdict.failed === true;
  const siteHost = getSiteHost(req.site);

  if (isFailed) {
    const reasonText = verdict.failReason ? `${verdict.failReason}.` : 'could not scan file.';
    return {
      type: 'warning',
      title: 'Could not scan this file',
      message: 'This file could not be scanned',
      detail: `Name: ${req.name || 'unnamed'}\nReason: ${reasonText}\nSite: ${siteHost}\n\nContinue only if you trust this file.`,
      buttons: ['Continue', 'Cancel'],
      defaultId: 1, // Cancel is default
      cancelId: 1,  // Esc cancels
      noLink: true
    };
  }

  if (req.kind === 'prompt') {
    const rawText = typeof req.data === 'string' ? req.data : '';
    const cleanSnippet = rawText.replace(/\s+/g, ' ').trim();
    const snippet = cleanSnippet.length > 70 ? cleanSnippet.slice(0, 70) + '...' : cleanSnippet;

    return {
      type: 'warning',
      title: 'Sensitive content detected',
      message: 'Sensitive marker found in a text prompt',
      detail: `Prompt: "${snippet}"\nSite: ${siteHost}\n\nContinue to send it, or Cancel to keep editing.`,
      buttons: ['Continue', 'Cancel'],
      defaultId: 1, // Cancel is default
      cancelId: 1,  // Esc cancels
      noLink: true
    };
  }

  // File detected
  const typeLabel = getFileTypeLabel(req);
  const sourceLine = formatSourceLine(verdict);
  const detailParts = [`Name: ${req.name || 'uploaded file'}`];
  if (sourceLine) {
    detailParts.push(sourceLine);
  }
  detailParts.push(`Site: ${siteHost}`);
  detailParts.push('\nContinue to upload this file, or Cancel to keep it from leaving this computer.');

  return {
    type: 'warning',
    title: 'Sensitive content detected',
    message: `Sensitive marker found in a file (${typeLabel})`,
    detail: detailParts.join('\n'),
    buttons: ['Continue', 'Cancel'],
    defaultId: 1, // Cancel is default
    cancelId: 1,  // Esc cancels
    noLink: true
  };
}

export async function showConfirmDialog(
  parentWindow: BaseWindow | null,
  req: ScanRequest,
  verdict: ScanVerdict
): Promise<Decision> {
  const options = buildDialogOptions(req, verdict);
  logger.info(`Opening native dialog for [${req.kind}] on [${req.site}]`);

  let result: Electron.MessageBoxReturnValue;
  try {
    if (parentWindow && !parentWindow.isDestroyed()) {
      parentWindow.focus();
      result = await dialog.showMessageBox(parentWindow, options);
    } else {
      result = await dialog.showMessageBox(options);
    }
  } catch (dialogErr) {
    logger.warn('dialog.showMessageBox with parent window failed; falling back to top-level dialog:', dialogErr);
    result = await dialog.showMessageBox(options);
  }

  if (result.response === 0) {
    logger.info(`User clicked CONTINUE for [${req.kind}] on [${req.site}]`);
    return { action: 'allow', reason: 'continued' };
  } else {
    logger.info(`User clicked CANCEL for [${req.kind}] on [${req.site}]`);
    return { action: 'block', reason: verdict.failed ? 'scan_failed' : 'cancelled' };
  }
}
