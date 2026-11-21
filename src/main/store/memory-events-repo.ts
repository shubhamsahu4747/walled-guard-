import { EventRow, NewEvent } from './schema';
import { EventsRepo, EventQuery, Page } from './events-repo';
import {
  AnalyticsKPIs,
  AnalyticsBreakdowns,
  TimeSeriesPoint,
  HeatmapCell,
  InsightItem
} from '../../shared/types';
import { calculateRiskScore } from '../analytics/risk-score';
import { generateInsights } from '../analytics/insights';

export function createMemoryEventsRepo(): EventsRepo {
  let records: EventRow[] = [];
  let autoId = 1;

  function filterByRange(items: EventRow[], startDate?: Date, endDate?: Date): EventRow[] {
    return items.filter((row) => {
      if (startDate && row.ts < startDate) return false;
      if (endDate && row.ts > endDate) return false;
      return true;
    });
  }

  async function insert(e: NewEvent): Promise<void> {
    const row: EventRow = {
      id: autoId++,
      ts: e.ts || new Date(),
      site: e.site,
      kind: e.kind,
      source: e.source || 'app',
      fileType: e.fileType || null,
      fileName: e.fileName || null,
      sizeBytes: e.sizeBytes || null,
      detected: e.detected,
      detectionSource: e.detectionSource || null,
      decision: e.decision,
      scanMs: e.scanMs || null,
      contentHash: e.contentHash,
      snippet: e.snippet || null
    };
    records.unshift(row);
  }

  async function list(q?: EventQuery): Promise<Page<EventRow>> {
    let result = [...records];

    if (q) {
      if (q.site) result = result.filter((r) => r.site === q.site);
      if (q.kind) result = result.filter((r) => r.kind === q.kind);
      if (q.source) result = result.filter((r) => r.source === q.source);
      if (q.decision) result = result.filter((r) => r.decision === q.decision);
      if (q.search) {
        const query = q.search.toLowerCase();
        result = result.filter(
          (r) =>
            (r.fileName && r.fileName.toLowerCase().includes(query)) ||
            r.contentHash.toLowerCase().includes(query) ||
            (r.snippet && r.snippet.toLowerCase().includes(query))
        );
      }
      if (q.startDate) result = result.filter((r) => r.ts >= q.startDate!);
      if (q.endDate) result = result.filter((r) => r.ts <= q.endDate!);
    }

    const total = result.length;
    const offset = q?.offset || 0;
    const limit = q?.limit || 50;

    return {
      items: result.slice(offset, offset + limit),
      total
    };
  }

  async function purgeOlderThan(ts: Date): Promise<number> {
    const initial = records.length;
    records = records.filter((r) => r.ts >= ts);
    return initial - records.length;
  }

  async function clear(): Promise<void> {
    records = [];
  }

  async function health(): Promise<'up' | 'down'> {
    return 'up';
  }

  // Analytics Aggregates
  const aggregate = {
    async kpis(startDate?: Date, endDate?: Date): Promise<AnalyticsKPIs> {
      const filtered = filterByRange(records, startDate, endDate);
      const totalInspected = filtered.length;
      const totalPrompts = filtered.filter((r) => r.kind === 'prompt').length;
      const totalFiles = filtered.filter((r) => r.kind === 'file').length;
      const sensitiveDetections = filtered.filter((r) => r.detected).length;
      const blockedCount = filtered.filter((r) => r.decision === 'cancelled').length;
      const overriddenCount = filtered.filter((r) => r.decision === 'continued').length;

      const leakRatePercent = totalInspected > 0
        ? parseFloat(((sensitiveDetections / totalInspected) * 100).toFixed(1))
        : 0;
      const overrideRatePercent = sensitiveDetections > 0
        ? parseFloat(((overriddenCount / sensitiveDetections) * 100).toFixed(1))
        : 0;

      // Repeat offenders
      const hashMap = new Map<string, number>();
      filtered.filter((r) => r.detected).forEach((r) => {
        hashMap.set(r.contentHash, (hashMap.get(r.contentHash) || 0) + 1);
      });
      const repeatCount = Array.from(hashMap.values()).filter((c) => c > 1).length;
      const fileDetectionsCount = filtered.filter((r) => r.detected && r.kind === 'file').length;

      const risk = calculateRiskScore({
        totalInspected,
        sensitiveDetections,
        overriddenCount,
        repeatContentCount: repeatCount,
        fileDetectionsCount
      });

      return {
        totalInspected,
        totalPrompts,
        totalFiles,
        sensitiveDetections,
        leakRatePercent,
        blockedCount,
        overriddenCount,
        overrideRatePercent,
        riskScore: risk.score,
        riskLevel: risk.level
      };
    },

    async timeSeries(startDate?: Date, endDate?: Date, bucket: 'hour' | 'day' = 'day'): Promise<TimeSeriesPoint[]> {
      const filtered = filterByRange(records, startDate, endDate);
      const buckets = new Map<string, { clean: number; sensitive: number }>();

      filtered.forEach((r) => {
        const d = new Date(r.ts);
        const key = bucket === 'day'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;

        const cur = buckets.get(key) || { clean: 0, sensitive: 0 };
        if (r.detected) {
          cur.sensitive++;
        } else {
          cur.clean++;
        }
        buckets.set(key, cur);
      });

      return Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([b, counts]) => ({ bucket: b, ...counts }));
    },

    async heatmap(startDate?: Date, endDate?: Date): Promise<HeatmapCell[]> {
      const filtered = filterByRange(records, startDate, endDate).filter((r) => r.detected);
      const grid = new Map<string, number>();

      filtered.forEach((r) => {
        const d = new Date(r.ts);
        const day = d.getDay(); // 0-6
        const hour = d.getHours(); // 0-23
        const key = `${day}_${hour}`;
        grid.set(key, (grid.get(key) || 0) + 1);
      });

      const cells: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}_${hour}`;
          cells.push({
            dayOfWeek: day,
            hour,
            count: grid.get(key) || 0
          });
        }
      }
      return cells;
    },

    async breakdowns(startDate?: Date, endDate?: Date): Promise<AnalyticsBreakdowns> {
      const filtered = filterByRange(records, startDate, endDate).filter((r) => r.detected);
      const total = filtered.length;

      function toItems(map: Map<string, number>) {
        return Array.from(map.entries()).map(([key, count]) => ({
          key,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        }));
      }

      const siteMap = new Map<string, number>();
      const typeMap = new Map<string, number>();
      const decisionMap = new Map<string, number>();
      const sourceMap = new Map<string, number>();

      filtered.forEach((r) => {
        siteMap.set(r.site, (siteMap.get(r.site) || 0) + 1);
        const typeKey = r.kind === 'prompt' ? 'Prompt' : (r.fileType ? r.fileType.toUpperCase() : 'File');
        typeMap.set(typeKey, (typeMap.get(typeKey) || 0) + 1);
        decisionMap.set(r.decision, (decisionMap.get(r.decision) || 0) + 1);
        if (r.detectionSource) {
          sourceMap.set(r.detectionSource, (sourceMap.get(r.detectionSource) || 0) + 1);
        }
      });

      return {
        bySite: toItems(siteMap),
        byFileType: toItems(typeMap),
        byDecision: toItems(decisionMap),
        byDetectionSource: toItems(sourceMap)
      };
    },

    async repeatOffenders(startDate?: Date, endDate?: Date): Promise<{ contentHash: string; count: number }[]> {
      const filtered = filterByRange(records, startDate, endDate).filter((r) => r.detected);
      const hashMap = new Map<string, number>();

      filtered.forEach((r) => {
        hashMap.set(r.contentHash, (hashMap.get(r.contentHash) || 0) + 1);
      });

      return Array.from(hashMap.entries())
        .filter(([, count]) => count > 1)
        .map(([contentHash, count]) => ({ contentHash, count }))
        .sort((a, b) => b.count - a.count);
    },

    async insights(startDate?: Date, endDate?: Date): Promise<InsightItem[]> {
      const filtered = filterByRange(records, startDate, endDate);
      const totalInspected = filtered.length;
      const detected = filtered.filter((r) => r.detected);
      const chatgptDetections = detected.filter((r) => r.site === 'chatgpt').length;
      const perplexityDetections = detected.filter((r) => r.site === 'perplexity').length;
      const overridden = detected.filter((r) => r.decision === 'continued').length;
      const overrideRatePercent = detected.length > 0 ? Math.round((overridden / detected.length) * 100) : 0;
      const ocrDetectionsCount = detected.filter((r) => r.detectionSource === 'ocr' || r.detectionSource === 'fuzzy').length;

      // Repeats
      const hashMap = new Map<string, number>();
      detected.forEach((r) => {
        hashMap.set(r.contentHash, (hashMap.get(r.contentHash) || 0) + 1);
      });
      const repeatCount = Array.from(hashMap.values()).filter((c) => c > 1).length;

      // Peak hour calculation
      const hourCounts = new Array(24).fill(0);
      detected.forEach((r) => {
        hourCounts[new Date(r.ts).getHours()]++;
      });
      let maxHour = 0;
      let maxCount = 0;
      hourCounts.forEach((cnt, hr) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          maxHour = hr;
        }
      });

      return generateInsights({
        totalInspected,
        sensitiveDetections: detected.length,
        chatgptDetections,
        perplexityDetections,
        overrideRatePercent,
        repeatOffenderCount: repeatCount,
        ocrDetectionsCount,
        peakHour: maxCount > 0 ? maxHour : undefined
      });
    }
  };

  return {
    insert,
    list,
    aggregate,
    purgeOlderThan,
    clear,
    health
  };
}
