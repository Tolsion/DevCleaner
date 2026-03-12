import { BrowserWindow, dialog, ipcMain } from 'electron';
import { rm } from 'node:fs/promises';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';

export const registerFolderHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.folders.pick, async (): Promise<IpcResponse<string[]>> => {
    const browserWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openDirectory', 'multiSelections']
    });

    if (result.canceled) {
      return { ok: true, data: [] };
    }

    return { ok: true, data: result.filePaths };
  });

  ipcMain.handle(IPC_CHANNELS.folders.delete, async (_event, targetPath: string): Promise<IpcResponse<{ success: boolean }>> => {
    try {
      await rm(targetPath, { recursive: true, force: true });
      return { ok: true, data: { success: true } };
    } catch (error) {
      return {
        ok: false,
        data: { success: false },
        error: error instanceof Error ? error.message : 'Failed to delete path'
      };
    }
  });
};
