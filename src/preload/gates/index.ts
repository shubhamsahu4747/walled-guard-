import { SiteAdapter } from '../../sites/types';
import { GuardBridge } from '../bridge';
import { attachPromptGate } from './prompt-gate';
import { attachFileGate } from './file-gate';
import { logger } from '../../shared/logger';

export function initGates(adapter: SiteAdapter, bridge: GuardBridge): void {
  logger.info(`Initializing DOM interception gates for [${adapter.name}]`);
  attachPromptGate(adapter, bridge);
  attachFileGate(adapter, bridge);
}
