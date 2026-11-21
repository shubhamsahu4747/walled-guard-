import { ipcRenderer } from 'electron';
import { ScanRequest, Decision } from '../shared/types';

export interface GuardBridge {
  scan: (req: ScanRequest) => Promise<Decision>;
}

export const guardBridge: GuardBridge = {
  scan: (req: ScanRequest): Promise<Decision> => {
    return ipcRenderer.invoke('guard:scan', req);
  }
};
