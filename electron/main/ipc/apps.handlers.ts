import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';
import type { AppsListResponse } from '../../shared/types/apps';
import { listInstalledApps } from '../services/apps.service';

export const registerAppsHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.apps.list, async (): Promise<IpcResponse<AppsListResponse>> => {
    try {
      const data = await listInstalledApps();
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        data: { supported: false, apps: [] },
        error: error instanceof Error ? error.message : 'Failed to list applications.'
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.apps.uninstall,
    async (_event, payload: { path?: string }): Promise<IpcResponse<{ removed: boolean }>> => {
      if (!payload?.path) {
        return { ok: false, data: { removed: false }, error: 'Invalid app path.' };
      }
      try {
        await shell.trashItem(payload.path);
        return { ok: true, data: { removed: true } };
      } catch (error) {
        return {
          ok: false,
          data: { removed: false },
          error: error instanceof Error ? error.message : 'Failed to remove app.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.apps.showInFinder,
    async (_event, payload: { path?: string }): Promise<IpcResponse<{ shown: boolean }>> => {
      if (!payload?.path) {
        return { ok: false, data: { shown: false }, error: 'Invalid app path.' };
      }
      try {
        const shown = shell.showItemInFolder(payload.path);
        return { ok: true, data: { shown } };
      } catch (error) {
        return {
          ok: false,
          data: { shown: false },
          error: error instanceof Error ? error.message : 'Failed to reveal app.'
        };
      }
    }
  );
};
