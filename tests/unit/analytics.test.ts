import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../../src/main/analytics/risk-score';
import { generateInsights } from '../../src/main/analytics/insights';
import { createMemoryEventsRepo } from '../../src/main/store/memory-events-repo';
import { NewEvent } from '../../src/main/store/schema';

describe('Risk Score Calculation (Architecture Formula)', () => {
  it('returns 0 score and Low level when no detections exist', () => {
    const res = calculateRiskScore({
      totalInspected: 100,
      sensitiveDetections: 0,
      overriddenCount: 0,
      repeatContentCount: 0,
      fileDetectionsCount: 0
    });
    expect(res.score).toBe(0);
    expect(res.level).toBe('Low');
  });

  it('calculates medium risk score for typical corporate usage', () => {
    const res = calculateRiskScore({
      totalInspected: 1000,
      sensitiveDetections: 40, // 4% leak rate
      overriddenCount: 15,     // 37.5% override rate
      repeatContentCount: 3,
      fileDetectionsCount: 10
    });
    expect(res.score).toBeGreaterThanOrEqual(30);
    expect(res.score).toBeLessThan(60);
    expect(res.level).toBe('Medium');
  });

  it('calculates high risk score when leak rate and overrides are saturated', () => {
    const res = calculateRiskScore({
      totalInspected: 100,
      sensitiveDetections: 30, // 30% leak rate (saturates 20% cap)
      overriddenCount: 25,     // > 80% override rate
      repeatContentCount: 5,
      fileDetectionsCount: 20
    });
    expect(res.score).toBeGreaterThanOrEqual(60);
    expect(res.level).toBe('High');
  });
});

describe('Insights Engine', () => {
  it('generates site-specific and override insights', () => {
    const insights = generateInsights({
      totalInspected: 200,
      sensitiveDetections: 20,
      chatgptDetections: 15,
      perplexityDetections: 5,
      overrideRatePercent: 45,
      repeatOffenderCount: 2,
      ocrDetectionsCount: 4,
      peakHour: 15
    });

    expect(insights.some((i) => i.id === 'site-chatgpt')).toBe(true);
    expect(insights.some((i) => i.id === 'override-rate-high')).toBe(true);
    expect(insights.some((i) => i.id === 'repeat-content')).toBe(true);
    expect(insights.some((i) => i.id === 'ocr-detection')).toBe(true);
    expect(insights.some((i) => i.id === 'peak-hour')).toBe(true);
  });
});

describe('Memory Events Repository & Aggregations', () => {
  it('inserts events and computes accurate KPIs, breakdowns, and time series', async () => {
    const repo = createMemoryEventsRepo();

    const sampleEvents: NewEvent[] = [
      {
        ts: new Date('2026-11-20T10:00:00Z'),
        site: 'chatgpt',
        kind: 'prompt',
        detected: false,
        decision: 'clean',
        contentHash: 'hash_clean_1'
      },
      {
        ts: new Date('2026-11-20T11:00:00Z'),
        site: 'chatgpt',
        kind: 'prompt',
        detected: true,
        detectionSource: 'plain-text',
        decision: 'cancelled',
        contentHash: 'hash_repeat_1'
      },
      {
        ts: new Date('2026-11-20T12:00:00Z'),
        site: 'chatgpt',
        kind: 'prompt',
        detected: true,
        detectionSource: 'plain-text',
        decision: 'continued',
        contentHash: 'hash_repeat_1' // repeated leak!
      },
      {
        ts: new Date('2026-11-20T14:00:00Z'),
        site: 'perplexity',
        kind: 'file',
        fileType: 'pdf',
        fileName: 'report.pdf',
        detected: true,
        detectionSource: 'ocr',
        decision: 'cancelled',
        contentHash: 'hash_pdf_1'
      }
    ];

    for (const ev of sampleEvents) {
      await repo.insert(ev);
    }

    // List
    const page = await repo.list();
    expect(page.total).toBe(4);

    // Filter by site
    const ppg = await repo.list({ site: 'perplexity' });
    expect(ppg.total).toBe(1);

    // Search
    const searchRes = await repo.list({ search: 'report' });
    expect(searchRes.total).toBe(1);

    // KPIs
    const kpis = await repo.aggregate.kpis();
    expect(kpis.totalInspected).toBe(4);
    expect(kpis.sensitiveDetections).toBe(3);
    expect(kpis.blockedCount).toBe(2);
    expect(kpis.overriddenCount).toBe(1);

    // Repeat Offenders
    const repeats = await repo.aggregate.repeatOffenders();
    expect(repeats.length).toBe(1);
    expect(repeats[0].contentHash).toBe('hash_repeat_1');
    expect(repeats[0].count).toBe(2);

    // Breakdowns
    const bd = await repo.aggregate.breakdowns();
    expect(bd.bySite.find((s) => s.key === 'chatgpt')?.count).toBe(2);
    expect(bd.bySite.find((s) => s.key === 'perplexity')?.count).toBe(1);

    // Heatmap
    const hm = await repo.aggregate.heatmap();
    expect(hm.length).toBe(7 * 24);

    // Clear
    await repo.clear();
    const afterClear = await repo.list();
    expect(afterClear.total).toBe(0);
  });
});
