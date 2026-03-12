import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';
import { setTrayVisible } from '../services/tray.service';

export const registerAppHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.app.showMain, async (): Promise<IpcResponse<{ shown: boolean }>> => {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow =
      windows.find((win) => {
        const url = win.webContents.getURL();
        return !url.includes('tray=1');
      }) ??
      windows.find((win) => win.getTitle() === 'Dev Cleaner') ??
      windows.find((win) => win.isVisible()) ??
      windows[0];
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      return { ok: true, data: { shown: true } };
    }
    return { ok: false, data: { shown: false }, error: 'Main window not found' };
  });

  ipcMain.handle(IPC_CHANNELS.app.hideTray, async (): Promise<IpcResponse<{ hidden: boolean }>> => {
    const windows = BrowserWindow.getAllWindows();
    const trayWindow = windows.find((win) => win.webContents.getURL().includes('tray=1'));
    if (trayWindow) {
      trayWindow.hide();
      return { ok: true, data: { hidden: true } };
    }
    return { ok: false, data: { hidden: false }, error: 'Tray window not found' };
  });

  ipcMain.handle(
    IPC_CHANNELS.app.navigate,
    async (_event, payload: { page?: string }): Promise<IpcResponse<{ navigated: boolean }>> => {
      const windows = BrowserWindow.getAllWindows();
      const mainWindow =
        windows.find((win) => !win.webContents.getURL().includes('tray=1')) ??
        windows.find((win) => win.getTitle() === 'Dev Cleaner') ??
        windows.find((win) => win.isVisible()) ??
        windows[0];
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        if (payload?.page) {
          mainWindow.webContents.send(IPC_CHANNELS.app.navigate, { page: payload.page });
        }
        return { ok: true, data: { navigated: true } };
      }
      return { ok: false, data: { navigated: false }, error: 'Main window not found' };
    }
  );

  ipcMain.handle(IPC_CHANNELS.app.quit, async (): Promise<IpcResponse<{ quit: boolean }>> => {
    app.quit();
    return { ok: true, data: { quit: true } };
  });

  ipcMain.handle(
    IPC_CHANNELS.app.setTrayVisible,
    async (_event, payload: { visible?: boolean }): Promise<IpcResponse<{ visible: boolean }>> => {
      try {
        const visible = Boolean(payload?.visible);
        const result = setTrayVisible(visible);
        return { ok: true, data: { visible: result } };
      } catch (error) {
        return {
          ok: false,
          data: { visible: false },
          error: error instanceof Error ? error.message : 'Failed to update tray visibility.'
        };
      }
    }
  );
};
