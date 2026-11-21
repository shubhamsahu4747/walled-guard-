import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { AppSettings } from '../../shared/types';
import {
  DEFAULT_MARKER,
  DEFAULT_RESPONSE_COLOR,
  MAX_FILE_SIZE_BYTES
} from '../../shared/constants';

let currentSettings: AppSettings = {
  markers: [DEFAULT_MARKER],
  responseColor: DEFAULT_RESPONSE_COLOR,
  failClosed: true,
  snippetLogging: false,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  retentionDays: 90
};

export function getSettings(): AppSettings {
  return { ...currentSettings };
}

export function registerSettingsHandler(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (): Promise<AppSettings> => {
    return getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (_event, newSettings: Partial<AppSettings>): Promise<boolean> => {
      currentSettings = { ...currentSettings, ...newSettings };
      return true;
    }
  );
}
