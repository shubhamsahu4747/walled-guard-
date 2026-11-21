import { BaseWindow, WebContentsView } from 'electron';
import path from 'path';
import fs from 'fs';
import { createTabManager, TabManager } from './tabs';
import { logger } from '../../shared/logger';

export interface AppWindow {
  window: BaseWindow;
  tabManager: TabManager;
  toggleSidebar: () => boolean;
  isSidebarCollapsed: () => boolean;
}

function getAppIconPath(): string {
  const icoPath = path.join(__dirname, '../../resources/icon.ico');
  const pngPath = path.join(__dirname, '../../resources/icon.png');
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath;
  }
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }
  return icoPath;
}

export function createMainWindow(): AppWindow {
  const iconPath = getAppIconPath();
  logger.info(`Using application icon: ${iconPath}`);

  const win = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Walled Guard',
    icon: iconPath
  });

  try {
    win.setIcon(iconPath);
  } catch (err) {
    logger.warn('Failed to set window icon explicitly:', err);
  }

  let isSidebarCollapsed = false;
  const EXPANDED_WIDTH = 240;
  const COLLAPSED_WIDTH = 64;

  function getSidebarWidth(): number {
    return isSidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  }

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
    const width = getSidebarWidth();
    sidebarView.setBounds({ x: 0, y: 0, width, height });
  }

  updateSidebarBounds();
  win.contentView.addChildView(sidebarView);

  const tabManager = createTabManager(win, (tab) => {
    try {
      sidebarView.webContents.send('tab-switched', tab);
    } catch {
      // ignore
    }
  });

  function toggleSidebar(): boolean {
    isSidebarCollapsed = !isSidebarCollapsed;
    const newWidth = getSidebarWidth();
    updateSidebarBounds();
    tabManager.setSidebarWidth(newWidth);
    try {
      sidebarView.webContents.send('sidebar-toggled', isSidebarCollapsed);
    } catch {
      // ignore
    }
    logger.info(`Sidebar toggled. Collapsed: ${isSidebarCollapsed}, width: ${newWidth}px`);
    return isSidebarCollapsed;
  }

  win.on('resize', () => {
    updateSidebarBounds();
    tabManager.updateBounds();
  });

  logger.info('Main window created successfully');

  return {
    window: win,
    tabManager,
    toggleSidebar,
    isSidebarCollapsed: () => isSidebarCollapsed
  };
}
