export type SiteId = 'chatgpt' | 'perplexity';

export type ContentKind = 'prompt' | 'file';

export type ClientSource = 'app' | 'browser';

export type FileType = 'text' | 'pdf' | 'image';

export type DetectionSource = 'plain-text' | 'text-layer' | 'ocr' | 'fuzzy';

export type DecisionAction = 'allow' | 'block';

export type DecisionReason = 'clean' | 'continued' | 'cancelled' | 'scan_failed';

export interface ScanRequest {
  site: SiteId;
  kind: ContentKind;
  source?: ClientSource;
  name?: string;
  mime?: string;
  data: string | Uint8Array | ArrayBuffer;
}

export interface ScanVerdict {
  found: boolean;
  source?: DetectionSource;
  location?: string;
  failed?: boolean;
  failReason?: string;
  ms: number;
}

export interface Decision {
  action: DecisionAction;
  reason: DecisionReason;
}

export interface GuardEvent {
  id?: number;
  ts: Date;
  site: SiteId;
  kind: ContentKind;
  source?: ClientSource | null;
  fileType?: FileType | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  detected: boolean;
  detectionSource?: DetectionSource | null;
  decision: DecisionReason;
  scanMs?: number | null;
  contentHash: string;
  snippet?: string | null;
}

export interface AppSettings {
  markers: string[];
  responseColor: string;
  failClosed: boolean;
  snippetLogging: boolean;
  maxFileSizeBytes: number;
  retentionDays: number;
}

export interface AnalyticsKPIs {
  totalInspected: number;
  totalPrompts: number;
  totalFiles: number;
  sensitiveDetections: number;
  leakRatePercent: number;
  blockedCount: number;
  overriddenCount: number;
  overrideRatePercent: number;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface TimeSeriesPoint {
  bucket: string;
  clean: number;
  sensitive: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0-6 (Sun-Sat or Mon-Sun)
  hour: number;      // 0-23
  count: number;
}

export interface BreakdownItem {
  key: string;
  count: number;
  percentage: number;
}

export interface AnalyticsBreakdowns {
  bySite: BreakdownItem[];
  byFileType: BreakdownItem[];
  byDecision: BreakdownItem[];
  byDetectionSource: BreakdownItem[];
}

export interface InsightItem {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}
