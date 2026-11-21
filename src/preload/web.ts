import { contextBridge } from 'electron';
import { guardBridge } from './bridge';
import { findAdapterByHostname } from '../sites/registry';
import { logger } from '../shared/logger';

// Expose safe typed API to web tabs
contextBridge.exposeInMainWorld('walledGuard', guardBridge);

// Identify site adapter
const adapter = findAdapterByHostname(window.location.hostname);
if (adapter) {
  logger.info(`Attached adapter [${adapter.name}] to ${window.location.hostname}`);
}
