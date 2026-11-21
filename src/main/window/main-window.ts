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
  let currentSidebarWidth = EXPANDED_WIDTH;
  let animTimer: NodeJS.Timeout | null = null;

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
    sidebarView.setBounds({ x: 0, y: 0, width: currentSidebarWidth, height });
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

  function animateSidebarTransition(targetWidth: number): void {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }

    const startWidth = currentSidebarWidth;
    const startTime = Date.now();
    const duration = 120; // 120ms snappy fluid animation

    animTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - Math.pow(1 - progress, 3)
      const ease = 1 - Math.pow(1 - progress, 3);
      const w = Math.round(startWidth + (targetWidth - startWidth) * ease);
      currentSidebarWidth = w;

      const [, height] = win.getContentSize();
      sidebarView.setBounds({ x: 0, y: 0, width: w, height });
      tabManager.setSidebarWidth(w);

      if (progress >= 1) {
        if (animTimer) {
          clearInterval(animTimer);
          animTimer = null;
        }
        currentSidebarWidth = targetWidth;
        sidebarView.setBounds({ x: 0, y: 0, width: targetWidth, height });
        tabManager.setSidebarWidth(targetWidth);
      }
    }, 16);
  }

  function toggleSidebar(): boolean {
    isSidebarCollapsed = !isSidebarCollapsed;
    const newWidth = getSidebarWidth();
    try {
      sidebarView.webContents.send('sidebar-toggled', isSidebarCollapsed);
    } catch {
      // ignore
    }
    animateSidebarTransition(newWidth);
    logger.info(`Sidebar toggled. Collapsed: ${isSidebarCollapsed}, width: ${newWidth}px`);
    return isSidebarCollapsed;
  }

  win.on('resize', () => {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
    currentSidebarWidth = getSidebarWidth();
    updateSidebarBounds();
    tabManager.setSidebarWidth(currentSidebarWidth);
  });

  logger.info('Main window created successfully');

  return {
    window: win,
    tabManager,
    toggleSidebar,
    isSidebarCollapsed: () => isSidebarCollapsed
  };
}
