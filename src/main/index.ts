import { app, ipcMain } from 'electron';
import { createMainWindow, AppWindow } from './window/main-window';
import { configureWebSession } from './window/session';
import { configureUploadGuard } from './network/upload-guard';
import { registerGuardHandler } from './ipc/guard-handler';
import { registerAnalyticsHandler } from './ipc/analytics-handler';
import { registerSettingsHandler, onSettingsChange, getSettings } from './ipc/settings-handler';
import { getEventsRepo } from './store/db';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { TabId } from './window/tabs';
import { logger } from '../shared/logger';

let appWindow: AppWindow | null = null;

async function bootstrap(): Promise<void> {
  logger.info('Bootstrapping Walled Guard application...');

  const ses = configureWebSession();
  configureUploadGuard(ses);

  registerAnalyticsHandler();
  registerSettingsHandler();
  registerGuardHandler(() => (appWindow ? appWindow.window : null));

  appWindow = createMainWindow();

  // Listen for settings color change and update active web tabs
  onSettingsChange((settings) => {
    if (appWindow) {
      appWindow.tabManager.updateResponseColor(settings.responseColor);
    }
  });

  // Handle tab switching requests from sidebar / renderer
  ipcMain.on(IPC_CHANNELS.NAVIGATE_TAB, (_event, tab: TabId) => {
    if (appWindow) {
      appWindow.tabManager.switchTab(tab);
    }
  });

  // Auto-purge events older than retention setting on startup (F4)
  const settings = getSettings();
  if (settings.retentionDays > 0) {
    const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);
    getEventsRepo()
      .purgeOlderThan(cutoff)
      .then((count) => {
        if (count > 0) {
          logger.info(`Startup auto-purge: deleted ${count} events older than ${settings.retentionDays} days`);
        }
      })
      .catch((err) => logger.warn('Startup retention purge failed:', err));
  }

  logger.info('Application ready and protected.');
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!appWindow) {
    bootstrap();
  }
});
