import { contextBridge } from 'electron';
import { guardBridge } from './bridge';
import { findAdapterByHostname } from '../sites/registry';
import { initGates } from './gates';
import { logger } from '../shared/logger';

// 1. Expose safe typed bridge to web page
contextBridge.exposeInMainWorld('walledGuard', guardBridge);

// 2. Identify site adapter based on current location
const adapter = findAdapterByHostname(window.location.hostname);
if (adapter) {
  logger.info(`Activating Walled Guard for ${adapter.name} (${window.location.hostname})`);
  initGates(adapter, guardBridge);
} else {
  logger.debug(`No matching site adapter for hostname: ${window.location.hostname}`);
}
