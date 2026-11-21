import { MAX_FILE_SIZE_BYTES, SUPPORTED_SITES } from './constants';
import { ScanRequest, SiteId, ContentKind, AppSettings } from './types';

export function isSiteId(val: unknown): val is SiteId {
  return typeof val === 'string' && (SUPPORTED_SITES as readonly string[]).includes(val);
}

export function isContentKind(val: unknown): val is ContentKind {
  return val === 'prompt' || val === 'file';
}

export function validateScanRequest(raw: unknown): { valid: true; data: ScanRequest } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Scan request must be an object' };
  }

  const req = raw as Record<string, unknown>;

  if (!isSiteId(req.site)) {
    return { valid: false, error: `Invalid site ID: ${String(req.site)}` };
  }

  if (!isContentKind(req.kind)) {
    return { valid: false, error: `Invalid content kind: ${String(req.kind)}` };
  }

  if (req.name !== undefined && typeof req.name !== 'string') {
    return { valid: false, error: 'File name must be a string' };
  }

  if (req.mime !== undefined && typeof req.mime !== 'string') {
    return { valid: false, error: 'MIME type must be a string' };
  }

  if (!req.data) {
    return { valid: false, error: 'Scan request data cannot be empty' };
  }

  if (typeof req.data === 'string') {
    if (req.data.length > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: 'Prompt data exceeds maximum allowed size' };
    }
  } else if (req.data instanceof Uint8Array || req.data instanceof ArrayBuffer) {
    const byteLength = req.data instanceof Uint8Array ? req.data.byteLength : req.data.byteLength;
    if (byteLength > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File data exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB cap` };
    }
  } else {
    return { valid: false, error: 'Data must be a string, Uint8Array, or ArrayBuffer' };
  }

  return {
    valid: true,
    data: {
      site: req.site,
      kind: req.kind,
      name: req.name as string | undefined,
      mime: req.mime as string | undefined,
      data: req.data as string | Uint8Array | ArrayBuffer
    }
  };
}

export function validateSettings(raw: unknown): { valid: true; data: AppSettings } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Settings must be an object' };
  }

  const s = raw as Record<string, unknown>;

  if (!Array.isArray(s.markers) || !s.markers.every((m) => typeof m === 'string' && m.trim().length > 0)) {
    return { valid: false, error: 'Markers must be an array of non-empty strings' };
  }

  if (typeof s.responseColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.responseColor)) {
    return { valid: false, error: 'Response color must be a valid hex color code (e.g. #00A86B)' };
  }

  if (typeof s.failClosed !== 'boolean') {
    return { valid: false, error: 'failClosed must be a boolean' };
  }

  if (typeof s.snippetLogging !== 'boolean') {
    return { valid: false, error: 'snippetLogging must be a boolean' };
  }

  if (typeof s.maxFileSizeBytes !== 'number' || s.maxFileSizeBytes <= 0) {
    return { valid: false, error: 'maxFileSizeBytes must be a positive number' };
  }

  if (typeof s.retentionDays !== 'number' || s.retentionDays < 0) {
    return { valid: false, error: 'retentionDays must be a non-negative number' };
  }

  return {
    valid: true,
    data: {
      markers: s.markers,
      responseColor: s.responseColor,
      failClosed: s.failClosed,
      snippetLogging: s.snippetLogging,
      maxFileSizeBytes: s.maxFileSizeBytes,
      retentionDays: s.retentionDays
    }
  };
}
