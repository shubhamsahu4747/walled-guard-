import { BaseWindow, WebContentsView } from 'electron';
import path from 'path';
import { PERSISTENT_PARTITION, DEFAULT_USER_AGENT } from '../../shared/constants';
import { applyResponseColor } from '../styling/response-style';
import { chatgptAdapter } from '../../sites/chatgpt';
import { perplexityAdapter } from '../../sites/perplexity';
import { getSettings } from '../ipc/settings-handler';
import { logger } from '../../shared/logger';

export type TabId = 'chatgpt' | 'perplexity' | 'dashboard' | 'settings';

export interface TabManager {
  switchTab: (id: TabId) => void;
  getActiveTab: () => TabId;
  updateBounds: () => void;
  getViews: () => Record<TabId, WebContentsView>;
}

export function createTabManager(parentWindow: BaseWindow): TabManager {
  let activeTab: TabId = 'chatgpt';

  const webPreload = path.join(__dirname, '../preload/web.js');
  const dashboardPreload = path.join(__dirname, '../preload/dashboard.js');

  // 1. ChatGPT View
  const chatgptView = new WebContentsView({
    webPreferences: {
      partition: PERSISTENT_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: webPreload
    }
  });
  chatgptView.webContents.setUserAgent(DEFAULT_USER_AGENT);
  chatgptView.webContents.loadURL('https://chatgpt.com');

  // Inject CSS on load
  chatgptView.webContents.on('did-finish-load', () => {
    applyResponseColor(chatgptView.webContents, getSettings().responseColor, chatgptAdapter);
  });
  chatgptView.webContents.on('did-navigate-in-page', () => {
    applyResponseColor(chatgptView.webContents, getSettings().responseColor, chatgptAdapter);
  });

  // 2. Perplexity View
  const perplexityView = new WebContentsView({
    webPreferences: {
      partition: PERSISTENT_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: webPreload
    }
  });
  perplexityView.webContents.setUserAgent(DEFAULT_USER_AGENT);
  perplexityView.webContents.loadURL('https://www.perplexity.ai');

  perplexityView.webContents.on('did-finish-load', () => {
    applyResponseColor(perplexityView.webContents, getSettings().responseColor, perplexityAdapter);
  });
  perplexityView.webContents.on('did-navigate-in-page', () => {
    applyResponseColor(perplexityView.webContents, getSettings().responseColor, perplexityAdapter);
  });

  // 3. Dashboard View
  const dashboardView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: dashboardPreload
    }
  });
  const dashboardHtml = path.join(__dirname, '../renderer/dashboard/index.html');
  dashboardView.webContents.loadFile(dashboardHtml);

  // 4. Settings View
  const settingsView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: dashboardPreload
    }
  });
  const settingsHtml = path.join(__dirname, '../renderer/settings/index.html');
  settingsView.webContents.loadFile(settingsHtml);

  const views: Record<TabId, WebContentsView> = {
    chatgpt: chatgptView,
    perplexity: perplexityView,
    dashboard: dashboardView,
    settings: settingsView
  };

  function updateBounds(): void {
    const [width, height] = parentWindow.getSize();
    const sidebarWidth = 240;
    const bounds = { x: sidebarWidth, y: 0, width: Math.max(0, width - sidebarWidth), height };

    Object.values(views).forEach((v) => {
      v.setBounds(bounds);
    });
  }

  function switchTab(id: TabId): void {
    logger.info(`Switching active tab to: ${id}`);
    activeTab = id;

    // Hide all
    Object.entries(views).forEach(([tabKey, v]) => {
      if (tabKey === id) {
        v.setVisible(true);
        try {
          parentWindow.contentView.addChildView(v);
        } catch {
          // view already added
        }
      } else {
        v.setVisible(false);
      }
    });

    parentWindow.setTitle(`Walled Guard - ${id.charAt(0).toUpperCase() + id.slice(1)}`);
  }

  // Initial bounds and activate tab
  updateBounds();
  switchTab('chatgpt');

  return {
    switchTab,
    getActiveTab: () => activeTab,
    updateBounds,
    getViews: () => views
  };
}
