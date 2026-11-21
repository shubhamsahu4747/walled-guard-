import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { ScanRequest, Decision } from '../shared/types';

export interface GuardBridge {
  scan: (req: ScanRequest) => Promise<Decision>;
}

export const guardBridge: GuardBridge = {
  scan: (req: ScanRequest): Promise<Decision> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GUARD_SCAN, req);
  }
};
