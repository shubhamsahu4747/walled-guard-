import { BaseWindow, WebContentsView, shell } from 'electron';
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
  updateResponseColor: (color: string) => Promise<void>;
}

function isAllowedNavigation(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    const allowed = [
      'chatgpt.com',
      'openai.com',
      'perplexity.ai',
      'accounts.google.com',
      'appleid.apple.com',
      'auth0.openai.com',
      'login.live.com'
    ];
    return allowed.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function configureTabSecurity(view: WebContentsView): void {
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedNavigation(url)) {
      shell.openExternal(url).catch((err) => logger.warn('Failed to open external link:', err));
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  view.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url).catch((err) => logger.warn('Failed to open external link:', err));
    }
  });
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
  configureTabSecurity(chatgptView);

  // Inject CSS on dom-ready, did-finish-load, and in-page navigation (SPA)
  const applyChatGPTStyle = () => {
    applyResponseColor(chatgptView.webContents, getSettings().responseColor, chatgptAdapter);
  };
  chatgptView.webContents.on('dom-ready', applyChatGPTStyle);
  chatgptView.webContents.on('did-finish-load', applyChatGPTStyle);
  chatgptView.webContents.on('did-navigate-in-page', applyChatGPTStyle);

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
  configureTabSecurity(perplexityView);

  const applyPerplexityStyle = () => {
    applyResponseColor(perplexityView.webContents, getSettings().responseColor, perplexityAdapter);
  };
  perplexityView.webContents.on('dom-ready', applyPerplexityStyle);
  perplexityView.webContents.on('did-finish-load', applyPerplexityStyle);
  perplexityView.webContents.on('did-navigate-in-page', applyPerplexityStyle);

  // 3. Dashboard View
  const dashboardView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nodeIntegration: false,
      preload: dashboardPreload
    }
  });
  dashboardView.webContents.on('console-message', (_e, _level, msg) => {
    logger.info(`[Dashboard Console] ${msg}`);
  });
  const dashboardHtml = path.join(__dirname, '../renderer/dashboard/index.html');
  dashboardView.webContents.loadFile(dashboardHtml);

  // 4. Settings View
  const settingsView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nodeIntegration: false,
      preload: dashboardPreload
    }
  });
  settingsView.webContents.on('console-message', (_e, _level, msg) => {
    logger.info(`[Settings Console] ${msg}`);
  });
  const settingsHtml = path.join(__dirname, '../renderer/settings/index.html');
  settingsView.webContents.loadFile(settingsHtml);

  const views: Record<TabId, WebContentsView> = {
    chatgpt: chatgptView,
    perplexity: perplexityView,
    dashboard: dashboardView,
    settings: settingsView
  };

  function getTabBounds(): { x: number; y: number; width: number; height: number } {
    const [width, height] = parentWindow.getContentSize();
    const sidebarWidth = 240;
    return {
      x: sidebarWidth,
      y: 0,
      width: Math.max(0, width - sidebarWidth),
      height
    };
  }

  function updateBounds(): void {
    const bounds = getTabBounds();
    const currentView = views[activeTab];
    if (currentView) {
      currentView.setBounds(bounds);
    }
  }

  function switchTab(id: TabId): void {
    logger.info(`Switching active tab to: ${id}`);
    activeTab = id;
    const bounds = getTabBounds();

    Object.entries(views).forEach(([tabKey, v]) => {
      if (tabKey === id) {
        v.setVisible(true);
        v.setBounds(bounds);
        try {
          if (parentWindow.contentView.children.includes(v)) {
            parentWindow.contentView.removeChildView(v);
          }
          parentWindow.contentView.addChildView(v);
        } catch {
          // view already attached
        }
      } else {
        v.setVisible(false);
        v.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        try {
          if (parentWindow.contentView.children.includes(v)) {
            parentWindow.contentView.removeChildView(v);
          }
        } catch {
          // ignore
        }
      }
    });

    parentWindow.setTitle(`Walled Guard - ${id.charAt(0).toUpperCase() + id.slice(1)}`);
  }

  async function updateResponseColor(color: string): Promise<void> {
    await Promise.all([
      applyResponseColor(chatgptView.webContents, color, chatgptAdapter),
      applyResponseColor(perplexityView.webContents, color, perplexityAdapter)
    ]);
  }

  // Initial bounds and activate tab
  updateBounds();
  switchTab('chatgpt');

  return {
    switchTab,
    getActiveTab: () => activeTab,
    updateBounds,
    getViews: () => views,
    updateResponseColor
  };
}
