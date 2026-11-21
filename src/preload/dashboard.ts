import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  AppSettings,
  AnalyticsKPIs,
  AnalyticsBreakdowns,
  TimeSeriesPoint,
  HeatmapCell,
  InsightItem
} from '../shared/types';
import { EventQuery, Page } from '../main/store/events-repo';
import { EventRow } from '../main/store/schema';

export interface DashboardAPI {
  getKPIs: (range?: string) => Promise<AnalyticsKPIs>;
  getTimeSeries: (range?: string, bucket?: 'hour' | 'day') => Promise<TimeSeriesPoint[]>;
  getHeatmap: (range?: string) => Promise<HeatmapCell[]>;
  getBreakdowns: (range?: string) => Promise<AnalyticsBreakdowns>;
  getInsights: (range?: string) => Promise<InsightItem[]>;
  getEvents: (query?: EventQuery) => Promise<Page<EventRow>>;
  exportEvents: (format: 'csv' | 'json') => Promise<string>;
  clearEvents: () => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  getAppStatus: () => Promise<{ dbStatus: 'up' | 'down'; guardActive: boolean }>;
  navigateTab: (tab: string) => void;
  onTabSwitched: (cb: (tab: string) => void) => void;
  triggerDebugDialog: (variant: 'prompt' | 'file' | 'failed') => Promise<unknown>;
}

export const dashboardApi: DashboardAPI = {
  getKPIs: (range?: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_KPIS, range),
  getTimeSeries: (range?: string, bucket?: 'hour' | 'day') =>
    ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_SERIES, range, bucket),
  getHeatmap: (range?: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_HEATMAP, range),
  getBreakdowns: (range?: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_BREAKDOWNS, range),
  getInsights: (range?: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_INSIGHTS, range),
  getEvents: (query?: EventQuery) => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_LIST, query),
  exportEvents: (format: 'csv' | 'json') => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_EXPORT, format),
  clearEvents: () => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_CLEAR),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  getAppStatus: () => ipcRenderer.invoke(IPC_CHANNELS.APP_STATUS),
  navigateTab: (tab: string) => ipcRenderer.send(IPC_CHANNELS.NAVIGATE_TAB, tab),
  onTabSwitched: (cb: (tab: string) => void) => {
    ipcRenderer.on('tab-switched', (_event, tab) => cb(tab));
  },
  triggerDebugDialog: (variant: 'prompt' | 'file' | 'failed') =>
    ipcRenderer.invoke(IPC_CHANNELS.GUARD_DEBUG_DIALOG, variant)
};

contextBridge.exposeInMainWorld('dashboardApi', dashboardApi);
