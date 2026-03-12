import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';
import type { DevToolInfo } from '../../shared/types/devtools';
import { getDevToolsInfo } from '../services/devtools.service';

export const registerDevToolsHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.devtools.get, async (): Promise<IpcResponse<DevToolInfo[]>> => {
    const data = await getDevToolsInfo();
    return { ok: true, data };
  });
};
