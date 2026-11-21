import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { AppSettings, AnalyticsKPIs } from '../shared/types';

export const dashboardBridge = {
  getKPIs: (): Promise<AnalyticsKPIs> => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_KPIS),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  navigateTab: (tab: string): void => ipcRenderer.send(IPC_CHANNELS.NAVIGATE_TAB, tab)
};

contextBridge.exposeInMainWorld('dashboardApi', dashboardBridge);
