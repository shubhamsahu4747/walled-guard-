import { EventRow } from '../../main/store/schema';
import { EventQuery } from '../../main/store/events-repo';

interface LogsWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dashboardApi?: any;
}

const win = window as unknown as LogsWindow;

let currentPage = 1;
let pageSize = 25;
let totalEvents = 0;

function formatScanTime(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return isToday
    ? `Today ${hours}:${minutes}:${seconds}`
    : `${d.toLocaleDateString()} ${hours}:${minutes}:${seconds}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadStatus(): Promise<void> {
  // DB indicators removed from UI per design
}

async function loadEvents(): Promise<void> {
  if (!win.dashboardApi) return;

  const siteFilter = (document.getElementById('filter-site') as HTMLSelectElement)?.value;
  const sourceFilter = (document.getElementById('filter-source') as HTMLSelectElement)?.value;
  const kindFilter = (document.getElementById('filter-kind') as HTMLSelectElement)?.value;
  const decisionFilter = (document.getElementById('filter-decision') as HTMLSelectElement)?.value;
  const searchQuery = (document.getElementById('filter-search') as HTMLInputElement)?.value;
  const perPageVal = (document.getElementById('per-page-select') as HTMLSelectElement)?.value;

  if (perPageVal) {
    pageSize = parseInt(perPageVal, 10) || 25;
  }

  const offset = (currentPage - 1) * pageSize;

  const query: EventQuery = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    site: siteFilter ? (siteFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: sourceFilter ? (sourceFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kind: kindFilter ? (kindFilter as any) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decision: decisionFilter ? (decisionFilter as any) : undefined,
    search: searchQuery ? searchQuery.trim() : undefined,
    limit: pageSize,
    offset
  };

  const tbody = document.getElementById('events-tbody');
  const paginationInfo = document.getElementById('pagination-info');
  const pageCurrentLabel = document.getElementById('page-current-label');
  const btnPrev = document.getElementById('btn-prev-page') as HTMLButtonElement | null;
  const btnNext = document.getElementById('btn-next-page') as HTMLButtonElement | null;
  const totalCountBadge = document.getElementById('total-count-badge');

  try {
    const page = await win.dashboardApi.getEvents(query);
    totalEvents = page.total;

    if (totalCountBadge) {
      totalCountBadge.textContent = `${totalEvents.toLocaleString()} events recorded`;
    }

    if (!page.items || page.items.length === 0) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 36px;">No audit events found matching filters.</td></tr>`;
      }
      if (paginationInfo) {
        paginationInfo.textContent = 'Showing 0 of 0 events';
      }
      if (pageCurrentLabel) {
        pageCurrentLabel.textContent = 'Page 1 of 1';
      }
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
    if (currentPage > totalPages) {
      currentPage = totalPages;
      await loadEvents();
      return;
    }

    const startIdx = offset + 1;
    const endIdx = Math.min(offset + page.items.length, totalEvents);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx}–${endIdx} of ${totalEvents.toLocaleString()} events`;
    }
    if (pageCurrentLabel) {
      pageCurrentLabel.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;

    if (tbody) {
      tbody.innerHTML = page.items
        .map((row: EventRow) => {
          const siteDisplay = row.site === 'chatgpt' ? 'ChatGPT' : 'Perplexity';
          const sourceDisplay = row.source === 'browser'
            ? `<span class="source-pill browser">Browser</span>`
            : `<span class="source-pill app">In-App</span>`;
          const typeDisplay = row.kind === 'file' ? (row.fileType?.toUpperCase() || 'FILE') : 'Prompt';
          const rawItem = row.kind === 'file' ? (row.fileName || 'Uploaded file') : 'Text prompt';
          const itemDisplay = escapeHtml(rawItem);
          const hashShort = row.contentHash ? row.contentHash.slice(0, 10) : '—';
          const foundDisplay = escapeHtml(row.detectionSource || 'None');
          const decisionClass = row.decision;
          const decisionDisplay = row.decision === 'cancelled'
            ? 'blocked'
            : row.decision === 'continued'
              ? 'approved'
              : row.decision;

          return `
          <tr>
            <td style="white-space: nowrap; color: var(--text-muted); font-size: 12px;">${formatDate(row.ts)}</td>
            <td style="font-weight: 500;">${siteDisplay}</td>
            <td>${sourceDisplay}</td>
            <td><span style="font-size: 11px; font-weight: 600; color: #475569; background: #e2e8f0; padding: 2px 7px; border-radius: 4px;">${typeDisplay}</span></td>
            <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemDisplay}">${itemDisplay}</td>
            <td><span class="hash-badge" title="${escapeHtml(row.contentHash || '')}">${hashShort}…</span></td>
            <td>${foundDisplay}</td>
            <td><span class="decision-pill ${decisionClass}">${decisionDisplay}</span></td>
            <td style="font-family: monospace; font-size: 12px;">${formatScanTime(row.scanMs)}</td>
          </tr>`;
        })
        .join('');
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--red); padding: 24px;">Failed to load events: ${escapeHtml(String(err))}</td></tr>`;
    }
  }
}

async function triggerExportCsv(): Promise<void> {
  if (!win.dashboardApi) return;
  try {
    const csv = await win.dashboardApi.exportEvents('csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `walled-guard-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export CSV failed:', err);
  }
}

async function triggerExportJson(): Promise<void> {
  if (!win.dashboardApi) return;
  try {
    const json = await win.dashboardApi.exportEvents('json');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `walled-guard-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export JSON failed:', err);
  }
}

async function triggerClearData(): Promise<void> {
  if (!win.dashboardApi) return;
  if (!confirm('Are you sure you want to permanently clear all security audit records? This action cannot be undone.')) {
    return;
  }
  try {
    await win.dashboardApi.clearEvents();
    currentPage = 1;
    await loadEvents();
  } catch (err) {
    alert(`Failed to clear data: ${err}`);
  }
}

function initEventHandlers(): void {
  // Filter dropdowns
  ['filter-site', 'filter-source', 'filter-kind', 'filter-decision'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentPage = 1;
      loadEvents();
    });
  });

  // Page size
  document.getElementById('per-page-select')?.addEventListener('change', () => {
    currentPage = 1;
    loadEvents();
  });

  // Search input debounced
  let debounceTimer: ReturnType<typeof setTimeout>;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentPage = 1;
      loadEvents();
    }, 250);
  });

  // Pagination buttons
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadEvents();
    }
  });

  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(totalEvents / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      loadEvents();
    }
  });

  // Action buttons
  document.getElementById('btn-export-csv')?.addEventListener('click', triggerExportCsv);
  document.getElementById('btn-export-json')?.addEventListener('click', triggerExportJson);
  document.getElementById('btn-clear-data')?.addEventListener('click', triggerClearData);

  // Periodic poll status & refresh
  setInterval(loadStatus, 5000);
  setInterval(loadEvents, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  initEventHandlers();
  loadStatus();
  loadEvents();
});
