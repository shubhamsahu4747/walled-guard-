import { contextBridge } from 'electron';
import { guardBridge } from './bridge';
import { findAdapterByHostname } from '../sites/registry';
import { initGates } from './gates';
import { logger } from '../shared/logger';

// 1. Expose safe typed bridge to web page
contextBridge.exposeInMainWorld('walledGuard', guardBridge);

// 2. Identify site adapter based on current location and attach gates reliably
let gatesInitialized = false;

function tryInit(): void {
  if (gatesInitialized) return;
  const host = window.location.hostname;
  if (!host) return;

  const adapter = findAdapterByHostname(host);
  if (adapter) {
    gatesInitialized = true;
    logger.info(`Activating Walled Guard for ${adapter.name} (${host})`);
    initGates(adapter, guardBridge);
  }
}

tryInit();

if (!gatesInitialized) {
  window.addEventListener('DOMContentLoaded', tryInit);
  window.addEventListener('load', tryInit);
}
