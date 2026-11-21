import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { logger } from '../../shared/logger';

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

export interface SplashWindow {
  window: BrowserWindow;
  closeSplash: () => void;
}

export function createSplashWindow(): SplashWindow {
  const iconPath = getAppIconPath();
  const win = new BrowserWindow({
    width: 480,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false
    }
  });

  const splashHtml = path.join(__dirname, '../renderer/splash/index.html');
  win.loadFile(splashHtml).catch((err) => {
    logger.warn('Failed to load splash HTML:', err);
  });

  win.once('ready-to-show', () => {
    win.show();
    logger.info('Splash window shown');
  });

  function closeSplash(): void {
    if (win.isDestroyed()) return;
    try {
      win.webContents.send('splash-fade-out');
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.close();
          win.destroy();
          logger.info('Splash window closed');
        }
      }, 350);
    } catch {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }
  }

  return {
    window: win,
    closeSplash
  };
}
