export const APP_NAME = 'Walled Guard';

export const DEFAULT_MARKER = 'WALLED_SENSITIVE';

export const DEFAULT_RESPONSE_COLOR = '#00A86B';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const SCAN_TIMEOUT_MS = 20000; // 20 seconds

export const VERDICT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const PERSISTENT_PARTITION = 'persist:walled-guard';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const MAX_SNIPPET_LENGTH = 80;

export const SUPPORTED_SITES = ['chatgpt', 'perplexity'] as const;
