import { renderActivityChart, renderDecisionDonut } from './charts';
import {
  AnalyticsKPIs,
  AnalyticsBreakdowns,
  InsightItem,
  HeatmapCell,
  TimeSeriesPoint
} from '../../shared/types';
import { EventRow } from '../../main/store/schema';
import { EventQuery } from '../../main/store/events-repo';

interface DashboardWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dashboardApi?: any;
}

const win = window as unknown as DashboardWindow;
let currentRange = '30d';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activityChartInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let donutChartInstance: any = null;

function formatScanTime(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${ms} ms`;
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return isToday ? `Today ${hours}:${minutes}` : `${d.toLocaleDateString()} ${hours}:${minutes}`;
}

async function loadStatus(): Promise<void> {
  if (!win.dashboardApi) return;
  try {
    const status = await win.dashboardApi.getAppStatus();
    const dot = document.getElementById('db-dot');
    const text = document.getElementById('db-status-text');
    if (status.dbStatus === 'up') {
      dot?.classList.remove('disconnected');
      dot?.classList.add('connected');
      if (text) text.textContent = 'Postgres connected';
    } else {
      dot?.classList.remove('connected');
      dot?.classList.add('disconnected');
      if (text) text.textContent = 'Memory store (Postgres offline)';
    }
  } catch {
    // ignore
  }
}

async function loadKPIs(): Promise<void> {
  if (!win.dashboardApi) return;
  const kpis: AnalyticsKPIs = await win.dashboardApi.getKPIs(currentRange);

  const elPrompts = document.getElementById('kpi-total-prompts');
  const elFiles = document.getElementById('kpi-total-files');
  const elDetections = document.getElementById('kpi-detections');
  const elLeakRate = document.getElementById('kpi-leak-rate');
  const elBlocked = document.getElementById('kpi-blocked');
  const elOverridden = document.getElementById('kpi-overridden');
  const elBlockedSub = document.getElementById('kpi-blocked-sub');
  const elOverrideSub = document.getElementById('kpi-override-sub');

  if (elPrompts) elPrompts.textContent = kpis.totalPrompts.toLocaleString();
  if (elFiles) elFiles.textContent = kpis.totalFiles.toLocaleString();
  if (elDetections) elDetections.textContent = kpis.sensitiveDetections.toLocaleString();
  if (elLeakRate) elLeakRate.textContent = `${kpis.leakRatePercent}%`;
  if (elBlocked) elBlocked.textContent = kpis.blockedCount.toLocaleString();
  if (elOverridden) elOverridden.textContent = kpis.overriddenCount.toLocaleString();

  const blockedPct = kpis.sensitiveDetections > 0
    ? Math.round((kpis.blockedCount / kpis.sensitiveDetections) * 100)
    : 0;
  if (elBlockedSub) elBlockedSub.textContent = `${blockedPct}% of matches`;
  if (elOverrideSub) elOverrideSub.textContent = `${kpis.overrideRatePercent}% approval rate`;

  // Risk Gauge
  const elRiskNumber = document.getElementById('risk-number');
  const elRiskBadge = document.getElementById('risk-badge');
  const elRiskMarker = document.getElementById('risk-marker');

  if (elRiskNumber) elRiskNumber.textContent = String(kpis.riskScore);
  if (elRiskBadge) {
    elRiskBadge.textContent = kpis.riskLevel;
    elRiskBadge.className = `risk-badge ${kpis.riskLevel}`;
  }
  if (elRiskMarker) {
    elRiskMarker.style.left = `${Math.min(100, Math.max(0, kpis.riskScore))}%`;
  }

  // Risk Mini Bars
  const leakBar = document.getElementById('risk-bar-leak');
  const overrideBar = document.getElementById('risk-bar-override');
  const leakVal = document.getElementById('risk-val-leak');
  const overrideVal = document.getElementById('risk-val-override');

  const leakShare = Math.round(kpis.leakRatePercent * 2);
  if (leakBar) leakBar.style.width = `${Math.min(100, leakShare)}%`;
  if (leakVal) leakVal.textContent = String(Math.round(kpis.leakRatePercent));

  const overrideShare = Math.round(kpis.overrideRatePercent);
  if (overrideBar) overrideBar.style.width = `${Math.min(100, overrideShare)}%`;
  if (overrideVal) overrideVal.textContent = String(Math.round(kpis.overrideRatePercent));
}

async function loadTimeSeries(): Promise<void> {
  if (!win.dashboardApi) return;
  const series: TimeSeriesPoint[] = await win.dashboardApi.getTimeSeries(currentRange, 'day');
  const canvas = document.getElementById('activity-chart') as HTMLCanvasElement;
  if (!canvas) return;

  if (activityChartInstance) {
    activityChartInstance.destroy();
  }
  activityChartInstance = renderActivityChart(canvas, series);
}

async function loadBreakdowns(): Promise<void> {
  if (!win.dashboardApi) return;
  const bd: AnalyticsBreakdowns = await win.dashboardApi.getBreakdowns(currentRange);

  // 1. Site Breakdown
  const siteContainer = document.getElementById('breakdown-site-list');
  if (siteContainer) {
    siteContainer.innerHTML = bd.bySite
      .map(
        (item) => `
      <div class="breakdown-row">
        <span class="breakdown-label">${item.key === 'chatgpt' ? 'ChatGPT' : 'Perplexity'}</span>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width: ${item.percentage}%;"></div></div>
        <span class="breakdown-value">${item.count} (${item.percentage}%)</span>
      </div>`
      )
      .join('');
  }

  // 2. Content Type Breakdown
  const typeContainer = document.getElementById('breakdown-type-list');
  if (typeContainer) {
    typeContainer.innerHTML = bd.byFileType
      .map(
        (item) => `
      <div class="breakdown-row">
        <span class="breakdown-label">${item.key}</span>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width: ${item.percentage}%;"></div></div>
        <span class="breakdown-value">${item.count}</span>
      </div>`
      )
      .join('');
  }

  // 3. Detection Source Breakdown
  const sourceContainer = document.getElementById('breakdown-source-list');
  if (sourceContainer) {
    sourceContainer.innerHTML = bd.byDetectionSource
      .map(
        (item) => `
      <div class="breakdown-row">
        <span class="breakdown-label">${item.key}</span>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width: ${item.percentage}%;"></div></div>
        <span class="breakdown-value">${item.count}</span>
      </div>`
      )
      .join('');
  }

  // 4. Decision Donut
  const donutCanvas = document.getElementById('decision-donut-chart') as HTMLCanvasElement;
  if (donutCanvas) {
    const cancelledCount = bd.byDecision.find((d) => d.key === 'cancelled')?.count || 0;
    const continuedCount = bd.byDecision.find((d) => d.key === 'continued')?.count || 0;

    if (donutChartInstance) {
      donutChartInstance.destroy();
    }
    donutChartInstance = renderDecisionDonut(donutCanvas, cancelledCount, continuedCount);
  }
}

async function loadInsights(): Promise<void> {
  if (!win.dashboardApi) return;
  const insights: InsightItem[] = await win.dashboardApi.getInsights(currentRange);
  const container = document.getElementById('insights-list');
  if (!container) return;

  container.innerHTML = insights
    .map(
      (item) => `
    <div class="insight-item ${item.type}">
      <div>
        <div class="insight-title">${item.title}</div>
        <div class="insight-desc">${item.description}</div>
      </div>
    </div>`
    )
    .join('');
}

async function loadHeatmap(): Promise<void> {
  if (!win.dashboardApi) return;
  const cells: HeatmapCell[] = await win.dashboardApi.getHeatmap(currentRange);
  const container = document.getElementById('heatmap-grid');
  if (!container) return;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  let html = '';
  for (let day = 1; day <= 6; day++) {
    // Mon-Sat
    html += `<div class="heatmap-row"><span class="heatmap-day">${days[day]}</span>`;
    for (let hour = 0; hour < 24; hour++) {
      const cell = cells.find((c) => c.dayOfWeek === day && c.hour === hour);
      const count = cell ? cell.count : 0;
      const intensity = count > 0 ? 0.2 + 0.8 * (count / maxCount) : 0;
      const bg = count > 0 ? `rgba(239, 68, 68, ${intensity.toFixed(2)})` : '#f1f5f9';
      html += `<div class="heatmap-cell" title="${days[day]} ${hour}:00 - ${count} matches" style="background: ${bg};"></div>`;
    }
    html += `</div>`;
  }
  // Sunday
  html += `<div class="heatmap-row"><span class="heatmap-day">Sun</span>`;
  for (let hour = 0; hour < 24; hour++) {
    const cell = cells.find((c) => c.dayOfWeek === 0 && c.hour === hour);
    const count = cell ? cell.count : 0;
    const intensity = count > 0 ? 0.2 + 0.8 * (count / maxCount) : 0;
    const bg = count > 0 ? `rgba(239, 68, 68, ${intensity.toFixed(2)})` : '#f1f5f9';
    html += `<div class="heatmap-cell" title="Sun ${hour}:00 - ${count} matches" style="background: ${bg};"></div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

async function loadEvents(): Promise<void> {
  if (!win.dashboardApi) return;
  const siteFilter = (document.getElementById('filter-site') as HTMLSelectElement)?.value;
  const sourceFilter = (document.getElementById('filter-source') as HTMLSelectElement)?.value;
  const kindFilter = (document.getElementById('filter-kind') as HTMLSelectElement)?.value;
  const decisionFilter = (document.getElementById('filter-decision') as HTMLSelectElement)?.value;
  const searchQuery = (document.getElementById('filter-search') as HTMLInputElement)?.value;

  const query: EventQuery = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    site: siteFilter ? (siteFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: sourceFilter ? (sourceFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kind: kindFilter ? (kindFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decision: decisionFilter ? (decisionFilter as any) : undefined,
    search: searchQuery ? searchQuery : undefined,
    limit: 8
  };

  const page = await win.dashboardApi.getEvents(query);
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;

  if (page.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No events recorded matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.items
    .map((row: EventRow) => {
      const siteDisplay = row.site === 'chatgpt' ? 'ChatGPT' : 'Perplexity';
      const sourceDisplay = row.source === 'browser'
        ? `<span class="source-pill browser">Browser</span>`
        : `<span class="source-pill app">In-App</span>`;
      const typeDisplay = row.kind === 'file' ? (row.fileType?.toUpperCase() || 'FILE') : 'Prompt';
      const itemDisplay = row.kind === 'file'
        ? (row.fileName || 'Uploaded file')
        : `Text prompt (hash ${row.contentHash.slice(0, 6)})`;
      const foundDisplay = row.detectionSource || 'None';
      const decisionClass = row.decision;
      const decisionDisplay = row.decision === 'cancelled'
        ? 'blocked'
        : row.decision === 'continued'
          ? 'approved'
          : row.decision;

      return `
      <tr>
        <td>${formatDate(row.ts)}</td>
        <td>${siteDisplay}</td>
        <td>${sourceDisplay}</td>
        <td>${typeDisplay}</td>
        <td>${itemDisplay}</td>
        <td>${foundDisplay}</td>
        <td><span class="decision-pill ${decisionClass}">${decisionDisplay}</span></td>
        <td>${formatScanTime(row.scanMs)}</td>
      </tr>`;
    })
    .join('');
}

export async function refreshAll(): Promise<void> {
  await Promise.all([
    loadStatus(),
    loadKPIs(),
    loadTimeSeries(),
    loadBreakdowns(),
    loadInsights(),
    loadHeatmap(),
    loadEvents()
  ]);
}

function initEventHandlers(): void {
  // Range selector pills
  const pills = document.querySelectorAll('.pill-btn');
  pills.forEach((btn) => {
    btn.addEventListener('click', () => {
      pills.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range') || '30d';
      refreshAll();
    });
  });

  // Filters
  ['filter-site', 'filter-source', 'filter-kind', 'filter-decision'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => loadEvents());
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadEvents(), 250);
  });

  // View all events button -> navigate to dedicated logs tab
  document.getElementById('btn-view-all-events')?.addEventListener('click', () => {
    if (win.dashboardApi && typeof win.dashboardApi.navigateTab === 'function') {
      win.dashboardApi.navigateTab('logs');
    }
  });

  // Export CSV
  async function triggerExportCsv() {
    if (!win.dashboardApi) return;
    const csv = await win.dashboardApi.exportEvents('csv');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walled-guard-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('btn-header-export-csv')?.addEventListener('click', triggerExportCsv);

  // Export JSON
  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    if (!win.dashboardApi) return;
    const json = await win.dashboardApi.exportEvents('json');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walled-guard-events-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Clear data
  document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
    if (!win.dashboardApi) return;
    if (confirm('Are you sure you want to clear all stored events? This cannot be undone.')) {
      await win.dashboardApi.clearEvents();
      refreshAll();
    }
  });

  // Periodic refresh every 10 seconds
  setInterval(refreshAll, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  initEventHandlers();
  refreshAll();
});
