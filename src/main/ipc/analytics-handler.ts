import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { AnalyticsKPIs } from '../../shared/types';

export function registerAnalyticsHandler(): void {
  ipcMain.handle(IPC_CHANNELS.ANALYTICS_KPIS, async (): Promise<AnalyticsKPIs> => {
    return {
      totalInspected: 0,
      totalPrompts: 0,
      totalFiles: 0,
      sensitiveDetections: 0,
      leakRatePercent: 0,
      blockedCount: 0,
      overriddenCount: 0,
      overrideRatePercent: 0,
      riskScore: 0,
      riskLevel: 'Low'
    };
  });
}
