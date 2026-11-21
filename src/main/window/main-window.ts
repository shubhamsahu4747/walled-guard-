import { BaseWindow, WebContentsView } from 'electron';
import path from 'path';
import { createTabManager, TabManager } from './tabs';
import { logger } from '../../shared/logger';

export interface AppWindow {
  window: BaseWindow;
  tabManager: TabManager;
}

export function createMainWindow(): AppWindow {
  const win = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Walled Guard'
  });

  // Sidebar / Shell view (left navigation)
  const sidebarView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/dashboard.js')
    }
  });

  sidebarView.webContents.on('console-message', (_e, _level, msg) => {
    logger.info(`[Sidebar Console] ${msg}`);
  });

  const shellHtml = path.join(__dirname, '../renderer/shell/index.html');
  sidebarView.webContents.loadFile(shellHtml);

  function updateSidebarBounds(): void {
    const [, height] = win.getContentSize();
    sidebarView.setBounds({ x: 0, y: 0, width: 240, height });
  }

  updateSidebarBounds();
  win.contentView.addChildView(sidebarView);

  const tabManager = createTabManager(win);

  win.on('resize', () => {
    updateSidebarBounds();
    tabManager.updateBounds();
  });

  logger.info('Main window created successfully');

  return {
    window: win,
    tabManager
  };
}
