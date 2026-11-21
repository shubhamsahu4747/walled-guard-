import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql, eq, and, gte, lte, desc, ilike, or } from 'drizzle-orm';
import { events, EventRow, NewEvent } from './schema';
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
import { logger } from '../../shared/logger';

export function createPgEventsRepo(connectionString: string): EventsRepo {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3000
  });

  const db: NodePgDatabase = drizzle(pool);

  async function health(): Promise<'up' | 'down'> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return 'up';
    } catch {
      return 'down';
    }
  }

  async function insert(e: NewEvent): Promise<void> {
    await db.insert(events).values(e);
  }

  async function list(q?: EventQuery): Promise<Page<EventRow>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (q?.site) conditions.push(eq(events.site, q.site));
    if (q?.kind) conditions.push(eq(events.kind, q.kind));
    if (q?.decision) conditions.push(eq(events.decision, q.decision));
    if (q?.startDate) conditions.push(gte(events.ts, q.startDate));
    if (q?.endDate) conditions.push(lte(events.ts, q.endDate));

    if (q?.search) {
      const pattern = `%${q.search}%`;
      conditions.push(
        or(
          ilike(events.fileName, pattern),
          ilike(events.contentHash, pattern),
          ilike(events.snippet, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = q?.limit || 50;
    const offset = q?.offset || 0;

    const [rows, countRes] = await Promise.all([
      db
        .select()
        .from(events)
        .where(whereClause)
        .orderBy(desc(events.ts))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(events)
        .where(whereClause)
    ]);

    return {
      items: rows,
      total: Number(countRes[0]?.total || 0)
    };
  }

  async function purgeOlderThan(ts: Date): Promise<number> {
    const res = await db.delete(events).where(lte(events.ts, ts)).returning({ id: events.id });
    return res.length;
  }

  async function clear(): Promise<void> {
    await db.delete(events);
  }

  const aggregate = {
    async kpis(startDate?: Date, endDate?: Date): Promise<AnalyticsKPIs> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];
      if (startDate) conditions.push(gte(events.ts, startDate));
      if (endDate) conditions.push(lte(events.ts, endDate));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const res = await db
        .select({
          totalInspected: sql<number>`count(*)`,
          totalPrompts: sql<number>`count(*) filter (where ${events.kind} = 'prompt')`,
          totalFiles: sql<number>`count(*) filter (where ${events.kind} = 'file')`,
          sensitiveDetections: sql<number>`count(*) filter (where ${events.detected} = true)`,
          blockedCount: sql<number>`count(*) filter (where ${events.decision} = 'cancelled')`,
          overriddenCount: sql<number>`count(*) filter (where ${events.decision} = 'continued')`,
          fileDetectionsCount: sql<number>`count(*) filter (where ${events.detected} = true and ${events.kind} = 'file')`
        })
        .from(events)
        .where(whereClause);

      const row = res[0] || {};
      const totalInspected = Number(row.totalInspected || 0);
      const totalPrompts = Number(row.totalPrompts || 0);
      const totalFiles = Number(row.totalFiles || 0);
      const sensitiveDetections = Number(row.sensitiveDetections || 0);
      const blockedCount = Number(row.blockedCount || 0);
      const overriddenCount = Number(row.overriddenCount || 0);
      const fileDetectionsCount = Number(row.fileDetectionsCount || 0);

      const leakRatePercent = totalInspected > 0
        ? parseFloat(((sensitiveDetections / totalInspected) * 100).toFixed(1))
        : 0;
      const overrideRatePercent = sensitiveDetections > 0
        ? parseFloat(((overriddenCount / sensitiveDetections) * 100).toFixed(1))
        : 0;

      // Repeat offenders count
      const repeats = await db
        .select({
          hash: events.contentHash,
          count: sql<number>`count(*)`
        })
        .from(events)
        .where(whereClause ? and(whereClause, eq(events.detected, true)) : eq(events.detected, true))
        .groupBy(events.contentHash)
        .having(sql`count(*) > 1`);

      const risk = calculateRiskScore({
        totalInspected,
        sensitiveDetections,
        overriddenCount,
        repeatContentCount: repeats.length,
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
      const truncSql = bucket === 'day' ? sql`date_trunc('day', ${events.ts})` : sql`date_trunc('hour', ${events.ts})`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];
      if (startDate) conditions.push(gte(events.ts, startDate));
      if (endDate) conditions.push(lte(events.ts, endDate));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          bucket: sql<string>`to_char(${truncSql}, ${bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH24:00'})`,
          clean: sql<number>`count(*) filter (where ${events.detected} = false)`,
          sensitive: sql<number>`count(*) filter (where ${events.detected} = true)`
        })
        .from(events)
        .where(whereClause)
        .groupBy(truncSql)
        .orderBy(truncSql);

      return rows.map((r) => ({
        bucket: r.bucket,
        clean: Number(r.clean || 0),
        sensitive: Number(r.sensitive || 0)
      }));
    },

    async heatmap(startDate?: Date, endDate?: Date): Promise<HeatmapCell[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [eq(events.detected, true)];
      if (startDate) conditions.push(gte(events.ts, startDate));
      if (endDate) conditions.push(lte(events.ts, endDate));

      const rows = await db
        .select({
          day: sql<number>`EXTRACT(DOW FROM ${events.ts})`,
          hour: sql<number>`EXTRACT(HOUR FROM ${events.ts})`,
          count: sql<number>`count(*)`
        })
        .from(events)
        .where(and(...conditions))
        .groupBy(sql`EXTRACT(DOW FROM ${events.ts})`, sql`EXTRACT(HOUR FROM ${events.ts})`);

      const grid = new Map<string, number>();
      rows.forEach((r) => {
        grid.set(`${Number(r.day)}_${Number(r.hour)}`, Number(r.count));
      });

      const cells: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          cells.push({
            dayOfWeek: day,
            hour,
            count: grid.get(`${day}_${hour}`) || 0
          });
        }
      }
      return cells;
    },

    async breakdowns(startDate?: Date, endDate?: Date): Promise<AnalyticsBreakdowns> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [eq(events.detected, true)];
      if (startDate) conditions.push(gte(events.ts, startDate));
      if (endDate) conditions.push(lte(events.ts, endDate));
      const whereClause = and(...conditions);

      const [bySite, byType, byDecision, bySource, totalRes] = await Promise.all([
        db.select({ key: events.site, count: sql<number>`count(*)` }).from(events).where(whereClause).groupBy(events.site),
        db.select({ key: sql<string>`coalesce(${events.fileType}, ${events.kind})`, count: sql<number>`count(*)` }).from(events).where(whereClause).groupBy(sql`coalesce(${events.fileType}, ${events.kind})`),
        db.select({ key: events.decision, count: sql<number>`count(*)` }).from(events).where(whereClause).groupBy(events.decision),
        db.select({ key: events.detectionSource, count: sql<number>`count(*)` }).from(events).where(and(whereClause, sql`${events.detectionSource} is not null`)).groupBy(events.detectionSource),
        db.select({ total: sql<number>`count(*)` }).from(events).where(whereClause)
      ]);

      const total = Number(totalRes[0]?.total || 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function format(items: any[]) {
        return items.map((i) => ({
          key: String(i.key),
          count: Number(i.count),
          percentage: total > 0 ? Math.round((Number(i.count) / total) * 100) : 0
        }));
      }

      return {
        bySite: format(bySite),
        byFileType: format(byType),
        byDecision: format(byDecision),
        byDetectionSource: format(bySource)
      };
    },

    async repeatOffenders(startDate?: Date, endDate?: Date): Promise<{ contentHash: string; count: number }[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [eq(events.detected, true)];
      if (startDate) conditions.push(gte(events.ts, startDate));
      if (endDate) conditions.push(lte(events.ts, endDate));

      const rows = await db
        .select({
          contentHash: events.contentHash,
          count: sql<number>`count(*)`
        })
        .from(events)
        .where(and(...conditions))
        .groupBy(events.contentHash)
        .having(sql`count(*) > 1`)
        .orderBy(desc(sql`count(*)`));

      return rows.map((r) => ({
        contentHash: r.contentHash,
        count: Number(r.count)
      }));
    },

    async insights(startDate?: Date, endDate?: Date): Promise<InsightItem[]> {
      const kpi = await this.kpis(startDate, endDate);
      const bd = await this.breakdowns(startDate, endDate);
      const repeats = await this.repeatOffenders(startDate, endDate);

      const chatgptItem = bd.bySite.find((s) => s.key === 'chatgpt');
      const perplexityItem = bd.bySite.find((s) => s.key === 'perplexity');
      const ocrItems = bd.byDetectionSource.filter((s) => s.key === 'ocr' || s.key === 'fuzzy');
      const ocrTotal = ocrItems.reduce((acc, curr) => acc + curr.count, 0);

      return generateInsights({
        totalInspected: kpi.totalInspected,
        sensitiveDetections: kpi.sensitiveDetections,
        chatgptDetections: chatgptItem?.count || 0,
        perplexityDetections: perplexityItem?.count || 0,
        overrideRatePercent: kpi.overrideRatePercent,
        repeatOffenderCount: repeats.length,
        ocrDetectionsCount: ocrTotal
      });
    }
  };

  logger.info('Postgres events repository initialized');

  return {
    insert,
    list,
    aggregate,
    purgeOlderThan,
    clear,
    health
  };
}
