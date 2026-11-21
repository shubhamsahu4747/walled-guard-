import { WebContents } from 'electron';
import { SiteAdapter } from '../../sites/types';
import { logger } from '../../shared/logger';

const insertedKeys = new WeakMap<WebContents, string>();

export async function applyResponseColor(
  webContents: WebContents,
  color: string,
  adapter: SiteAdapter
): Promise<void> {
  try {
    const existingKey = insertedKeys.get(webContents);
    if (existingKey) {
      await webContents.removeInsertedCSS(existingKey);
      insertedKeys.delete(webContents);
    }

    const css = adapter.responseCss(color);
    const newKey = await webContents.insertCSS(css);
    insertedKeys.set(webContents, newKey);
    logger.debug(`Injected response CSS for ${adapter.id} with color ${color}`);
  } catch (err) {
    logger.error(`Failed to inject response CSS for ${adapter.id}:`, err);
  }
}
