import { AppSettings } from '../../shared/types';
import { DEFAULT_MARKER } from '../../shared/constants';

interface SettingsWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dashboardApi?: any;
}

const win = window as unknown as SettingsWindow;
let currentSettings: AppSettings = {
  markers: [DEFAULT_MARKER],
  responseColor: '#00A86B',
  failClosed: true,
  snippetLogging: false,
  maxFileSizeBytes: 52428800,
  retentionDays: 90
};

function renderMarkers(): void {
  const container = document.getElementById('markers-tags');
  if (!container) return;

  container.innerHTML = currentSettings.markers
    .map((marker) => {
      const isDefault = marker === DEFAULT_MARKER;
      return `
      <div class="tag">
        <span>${marker}</span>
        ${isDefault ? '<span class="default-badge">default</span>' : `<span class="remove-btn" data-marker="${marker}">&times;</span>`}
      </div>`;
    })
    .join('');

  container.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const marker = btn.getAttribute('data-marker');
      if (marker && marker !== DEFAULT_MARKER) {
        currentSettings.markers = currentSettings.markers.filter((m) => m !== marker);
        saveSettings({ markers: currentSettings.markers });
        renderMarkers();
      }
    });
  });
}

function updateColorPreviews(color: string): void {
  const light = document.getElementById('preview-text-light');
  const dark = document.getElementById('preview-text-dark');
  if (light) light.style.color = color;
  if (dark) dark.style.color = color;

  const hexInput = document.getElementById('input-hex-color') as HTMLInputElement;
  if (hexInput && hexInput.value !== color) {
    hexInput.value = color;
  }

  // Update active swatch
  document.querySelectorAll('.swatch').forEach((swatch) => {
    const swColor = swatch.getAttribute('data-color');
    if (swColor?.toLowerCase() === color.toLowerCase()) {
      swatch.classList.add('active');
    } else {
      swatch.classList.remove('active');
    }
  });
}

async function saveSettings(partial: Partial<AppSettings>): Promise<void> {
  if (!win.dashboardApi) return;
  currentSettings = { ...currentSettings, ...partial };
  await win.dashboardApi.setSettings(partial);
}

async function loadSettings(): Promise<void> {
  if (!win.dashboardApi) return;
  currentSettings = await win.dashboardApi.getSettings();

  renderMarkers();

  // Fail-closed toggle
  const toggleFail = document.getElementById('toggle-fail-closed') as HTMLInputElement;
  if (toggleFail) toggleFail.checked = currentSettings.failClosed;

  // Max size
  const selectSize = document.getElementById('select-max-file-size') as HTMLSelectElement;
  if (selectSize) selectSize.value = String(currentSettings.maxFileSizeBytes);

  // Color
  updateColorPreviews(currentSettings.responseColor);

  // Snippet toggle
  const toggleSnippet = document.getElementById('toggle-snippet') as HTMLInputElement;
  if (toggleSnippet) toggleSnippet.checked = currentSettings.snippetLogging;

  // Retention
  const selectRetention = document.getElementById('select-retention') as HTMLSelectElement;
  if (selectRetention) selectRetention.value = String(currentSettings.retentionDays);

  // DB Health
  checkDb();
}

async function checkDb(): Promise<void> {
  if (!win.dashboardApi) return;
  const status = await win.dashboardApi.getAppStatus();
  const pill = document.getElementById('settings-db-status');
  const note = document.getElementById('db-last-status-note');
  if (status.dbStatus === 'up') {
    if (pill) {
      pill.textContent = 'Connected';
      pill.className = 'db-status-pill connected';
    }
    if (note) note.textContent = 'Connected to local store';
  } else {
    if (pill) {
      pill.textContent = 'Offline (Memory Fallback)';
      pill.className = 'db-status-pill offline';
    }
    if (note) note.textContent = 'Using in-memory session store';
  }
}

function initHandlers(): void {
  // Add Marker
  const addBtn = document.getElementById('btn-add-marker');
  const inputMarker = document.getElementById('input-new-marker') as HTMLInputElement;
  const handleAddMarker = () => {
    const val = inputMarker.value.trim().toUpperCase();
    if (val && !currentSettings.markers.includes(val)) {
      currentSettings.markers.push(val);
      saveSettings({ markers: currentSettings.markers });
      renderMarkers();
      inputMarker.value = '';
    }
  };
  addBtn?.addEventListener('click', handleAddMarker);
  inputMarker?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddMarker();
  });

  // Fail Closed
  document.getElementById('toggle-fail-closed')?.addEventListener('change', (e) => {
    saveSettings({ failClosed: (e.target as HTMLInputElement).checked });
  });

  // Max file size
  document.getElementById('select-max-file-size')?.addEventListener('change', (e) => {
    saveSettings({ maxFileSizeBytes: Number((e.target as HTMLSelectElement).value) });
  });

  // Color swatches
  document.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.getAttribute('data-color');
      if (color) {
        updateColorPreviews(color);
        saveSettings({ responseColor: color });
      }
    });
  });

  // Hex color input
  document.getElementById('input-hex-color')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      updateColorPreviews(val);
      saveSettings({ responseColor: val });
    }
  });

  // Snippet logging toggle
  document.getElementById('toggle-snippet')?.addEventListener('change', (e) => {
    saveSettings({ snippetLogging: (e.target as HTMLInputElement).checked });
  });

  // Retention
  document.getElementById('select-retention')?.addEventListener('change', (e) => {
    saveSettings({ retentionDays: Number((e.target as HTMLSelectElement).value) });
  });

  // Test DB
  document.getElementById('btn-test-db')?.addEventListener('click', checkDb);

  // Export CSV
  document.getElementById('btn-settings-export-csv')?.addEventListener('click', async () => {
    if (!win.dashboardApi) return;
    const csv = await win.dashboardApi.exportEvents('csv');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walled-guard-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Export JSON
  document.getElementById('btn-settings-export-json')?.addEventListener('click', async () => {
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
  document.getElementById('btn-settings-clear')?.addEventListener('click', async () => {
    if (!win.dashboardApi) return;
    if (confirm('Are you sure you want to clear all stored events? This cannot be undone.')) {
      await win.dashboardApi.clearEvents();
      alert('Stored events have been cleared.');
    }
  });

  // Entrance animation on tab switch
  if (win.dashboardApi?.onTabSwitched) {
    win.dashboardApi.onTabSwitched((tab: string) => {
      if (tab === 'settings') {
        document.body.classList.remove('tab-enter-anim');
        void document.body.offsetWidth; // trigger reflow
        document.body.classList.add('tab-enter-anim');
        loadSettings();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHandlers();
  loadSettings();
});
