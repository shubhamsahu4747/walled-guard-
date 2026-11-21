import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  AnalyticsKPIs,
  AnalyticsBreakdowns,
  TimeSeriesPoint,
  HeatmapCell,
  InsightItem
} from '../../shared/types';
import { getEventsRepo, checkDbHealth } from '../store/db';
import { EventQuery, Page } from '../store/events-repo';
import { EventRow } from '../store/schema';
import { logger } from '../../shared/logger';

function parseDateRange(range?: string): { start?: Date; end?: Date } {
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  }
  if (range === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (range === '30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  return {};
}

export function registerAnalyticsHandler(): void {
  // KPIs
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_KPIS,
    async (_event, range?: string): Promise<AnalyticsKPIs> => {
      const { start, end } = parseDateRange(range);
      const repo = getEventsRepo();
      return await repo.aggregate.kpis(start, end);
    }
  );

  // Time Series
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_SERIES,
    async (_event, range?: string, bucket: 'hour' | 'day' = 'day'): Promise<TimeSeriesPoint[]> => {
      const { start, end } = parseDateRange(range);
      const repo = getEventsRepo();
      return await repo.aggregate.timeSeries(start, end, bucket);
    }
  );

  // Heatmap
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_HEATMAP,
    async (_event, range?: string): Promise<HeatmapCell[]> => {
      const { start, end } = parseDateRange(range);
      const repo = getEventsRepo();
      return await repo.aggregate.heatmap(start, end);
    }
  );

  // Breakdowns
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_BREAKDOWNS,
    async (_event, range?: string): Promise<AnalyticsBreakdowns> => {
      const { start, end } = parseDateRange(range);
      const repo = getEventsRepo();
      return await repo.aggregate.breakdowns(start, end);
    }
  );

  // Insights
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_INSIGHTS,
    async (_event, range?: string): Promise<InsightItem[]> => {
      const { start, end } = parseDateRange(range);
      const repo = getEventsRepo();
      return await repo.aggregate.insights(start, end);
    }
  );

  // Events list
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_LIST,
    async (_event, q?: EventQuery): Promise<Page<EventRow>> => {
      const repo = getEventsRepo();
      return await repo.list(q);
    }
  );

  // Events export (CSV / JSON)
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_EXPORT,
    async (_event, format: 'csv' | 'json'): Promise<string> => {
      const repo = getEventsRepo();
      const page = await repo.list({ limit: 10000 });

      if (format === 'json') {
        return JSON.stringify(page.items, null, 2);
      }

      // Format CSV
      const headers = [
        'id',
        'timestamp',
        'site',
        'kind',
        'source',
        'fileType',
        'fileName',
        'sizeBytes',
        'detected',
        'detectionSource',
        'decision',
        'scanMs',
        'contentHash'
      ];
      const rows = page.items.map((row) => [
        row.id,
        new Date(row.ts).toISOString(),
        row.site,
        row.kind,
        row.source || 'app',
        row.fileType || '',
        `"${(row.fileName || '').replace(/"/g, '""')}"`,
        row.sizeBytes || 0,
        row.detected,
        row.detectionSource || '',
        row.decision,
        row.scanMs || 0,
        row.contentHash
      ]);

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }
  );

  // Events clear
  ipcMain.handle(IPC_CHANNELS.EVENTS_CLEAR, async (): Promise<boolean> => {
    logger.info('Clearing all events data');
    const repo = getEventsRepo();
    await repo.clear();
    return true;
  });

  // App & Database Status
  ipcMain.handle(IPC_CHANNELS.APP_STATUS, async () => {
    const health = await checkDbHealth();
    return {
      dbStatus: health,
      guardActive: true
    };
  });
}
