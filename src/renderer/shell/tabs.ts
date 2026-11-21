export function initShell(): void {
  const nav = document.getElementById('workspace-nav');
  if (nav) {
    nav.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const item = target?.closest<HTMLLIElement>('.nav-item');
      if (!item) return;

      const tab = item.getAttribute('data-tab');
      if (!tab) return;

      // Update UI active class
      const allItems = nav.querySelectorAll<HTMLLIElement>('.nav-item');
      allItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');

      // Dispatch navigation via dashboardApi bridge
      const api = (window as unknown as { dashboardApi?: { navigateTab: (t: string) => void } }).dashboardApi;
      if (api?.navigateTab) {
        api.navigateTab(tab);
      } else {
        console.warn('dashboardApi.navigateTab not available');
      }
    });
  }

  // Sidebar Toggle (Hide / Unhide)
  const btnToggleSidebar = document.getElementById('sidebar-toggle-btn');
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', async () => {
      const api = (window as unknown as { dashboardApi?: { toggleSidebar: () => Promise<boolean> } }).dashboardApi;
      if (api?.toggleSidebar) {
        const isCollapsed = await api.toggleSidebar();
        document.body.classList.toggle('collapsed', isCollapsed);
        btnToggleSidebar.setAttribute('title', isCollapsed ? 'Unhide sidebar (Ctrl+B)' : 'Hide sidebar (Ctrl+B)');
      }
    });
  }

  // Quick action: Export CSV
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      const api = (window as unknown as { dashboardApi?: { exportEvents: (f: string) => Promise<string> } }).dashboardApi;
      if (api?.exportEvents) {
        try {
          const csv = await api.exportEvents('csv');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `walled-guard-events-${Date.now()}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Failed to export CSV:', err);
        }
      }
    });
  }

  // Quick action: Clear data
  const btnClearData = document.getElementById('btn-clear-data');
  if (btnClearData) {
    btnClearData.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all logged security events?')) return;
      const api = (window as unknown as { dashboardApi?: { clearEvents: () => Promise<boolean> } }).dashboardApi;
      if (api?.clearEvents) {
        await api.clearEvents();
        alert('All security events cleared successfully.');
      }
    });
  }

  // Quick action: Scan file debug
  const btnScanFile = document.getElementById('btn-scan-file');
  if (btnScanFile) {
    btnScanFile.addEventListener('click', async () => {
      const api = (window as unknown as { dashboardApi?: { triggerDebugDialog: (v: string) => Promise<unknown> } }).dashboardApi;
      if (api?.triggerDebugDialog) {
        await api.triggerDebugDialog('file');
      }
    });
  }
}

// Immediate execution or DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShell);
} else {
  initShell();
}
