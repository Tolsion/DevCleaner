import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';
import type { SystemInfo } from '../../shared/types/system';
import { getSystemInfo, readPowerSavingMode, updatePowerSavingMode } from '../services/system.service';

export const registerSystemHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.system.get, async (): Promise<IpcResponse<SystemInfo>> => {
    const info = await getSystemInfo();
    return {
      ok: true,
      data: info
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.system.getPowerSaving,
    async (): Promise<IpcResponse<{ enabled: boolean | null }>> => {
      try {
        const enabled = await readPowerSavingMode();
        return { ok: true, data: { enabled } };
      } catch (error) {
        return {
          ok: false,
          data: { enabled: null },
          error: error instanceof Error ? error.message : 'Failed to read power saving mode.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.system.setPowerSaving,
    async (_event, payload: { enabled?: boolean }): Promise<IpcResponse<{ enabled: boolean }>> => {
      if (typeof payload?.enabled !== 'boolean') {
        return {
          ok: false,
          data: { enabled: false },
          error: 'Invalid payload'
        };
      }
      try {
        const enabled = await updatePowerSavingMode(payload.enabled);
        return { ok: true, data: { enabled } };
      } catch (error) {
        return {
          ok: false,
          data: { enabled: payload.enabled },
          error: error instanceof Error ? error.message : 'Failed to update power saving mode.'
        };
      }
    }
  );
};
