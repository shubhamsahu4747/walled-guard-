import { WebContents } from 'electron';
import { SiteAdapter } from '../../sites/types';
import { chatgptAdapter } from '../../sites/chatgpt';
import { perplexityAdapter } from '../../sites/perplexity';
import { logger } from '../../shared/logger';

const insertedKeys = new WeakMap<WebContents, string>();

export async function applyResponseColor(
  webContents: WebContents,
  color: string,
  adapter: SiteAdapter
): Promise<void> {
  try {
    if (webContents.isDestroyed()) return;

    const existingKey = insertedKeys.get(webContents);
    if (existingKey) {
      try {
        await webContents.removeInsertedCSS(existingKey);
      } catch {
        // key may have expired on navigation
      }
      insertedKeys.delete(webContents);
    }

    const css = adapter.responseCss(color);
    const newKey = await webContents.insertCSS(css);
    insertedKeys.set(webContents, newKey);

    // Also inject / update a DOM <style> element with highest specificity
    const serializedCss = JSON.stringify(css);
    await webContents.executeJavaScript(`
      (function() {
        try {
          let styleEl = document.getElementById('walled-guard-response-style');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'walled-guard-response-style';
            const target = document.head || document.documentElement;
            if (target) target.appendChild(styleEl);
          }
          if (styleEl) {
            styleEl.textContent = ${serializedCss};
          }
        } catch (e) {}
      })();
    `).catch(() => {});

    logger.debug(`Injected response CSS for [${adapter.id}] with color [${color}]`);
  } catch (err) {
    logger.error(`Failed to inject response CSS for ${adapter.id}:`, err);
  }
}

export async function updateAllTabsColor(
  chatgptWebContents: WebContents,
  perplexityWebContents: WebContents,
  color: string
): Promise<void> {
  logger.info(`Updating AI response color across all tabs to: ${color}`);
  await Promise.all([
    applyResponseColor(chatgptWebContents, color, chatgptAdapter),
    applyResponseColor(perplexityWebContents, color, perplexityAdapter)
  ]);
}
