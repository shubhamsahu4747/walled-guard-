import { EventRow, NewEvent } from './schema';
import {
  AnalyticsKPIs,
  AnalyticsBreakdowns,
  TimeSeriesPoint,
  HeatmapCell,
  InsightItem
} from '../../shared/types';

export interface EventQuery {
  site?: 'chatgpt' | 'perplexity';
  kind?: 'prompt' | 'file';
  source?: 'app' | 'browser';
  decision?: 'clean' | 'continued' | 'cancelled' | 'scan_failed';
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface AnalyticsQueries {
  kpis: (startDate?: Date, endDate?: Date) => Promise<AnalyticsKPIs>;
  timeSeries: (startDate?: Date, endDate?: Date, bucket?: 'hour' | 'day') => Promise<TimeSeriesPoint[]>;
  heatmap: (startDate?: Date, endDate?: Date) => Promise<HeatmapCell[]>;
  breakdowns: (startDate?: Date, endDate?: Date) => Promise<AnalyticsBreakdowns>;
  repeatOffenders: (startDate?: Date, endDate?: Date) => Promise<{ contentHash: string; count: number }[]>;
  insights: (startDate?: Date, endDate?: Date) => Promise<InsightItem[]>;
}

export interface EventsRepo {
  insert: (e: NewEvent) => Promise<void>;
  list: (q?: EventQuery) => Promise<Page<EventRow>>;
  aggregate: AnalyticsQueries;
  purgeOlderThan: (ts: Date) => Promise<number>;
  clear: () => Promise<void>;
  health: () => Promise<'up' | 'down'>;
}
