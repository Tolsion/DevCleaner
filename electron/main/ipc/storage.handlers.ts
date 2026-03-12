import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { IpcResponse } from '../../shared/types/ipc';
import { storageService } from '../services/storage.service';

const emptyTotals = {
  totalCleanedBytes: 0,
  totalCleanedFolders: 0,
  totalCleanedProjects: 0
};

export const registerStorageHandlers = () => {
  ipcMain.handle(
    IPC_CHANNELS.storage.getCleanupTotals,
    async (): Promise<IpcResponse<typeof emptyTotals>> => {
      try {
        const totals = await storageService.getCleanupTotals();
        return { ok: true, data: totals };
      } catch (error) {
        return {
          ok: false,
          data: emptyTotals,
          error: error instanceof Error ? error.message : 'Failed to load cleanup totals.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.setCleanupTotals,
    async (_event, payload): Promise<IpcResponse<{ saved: boolean }>> => {
      try {
        await storageService.setCleanupTotals(payload);
        return { ok: true, data: { saved: true } };
      } catch (error) {
        return {
          ok: false,
          data: { saved: false },
          error: error instanceof Error ? error.message : 'Failed to save cleanup totals.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.resetCleanupTotals,
    async (): Promise<IpcResponse<{ reset: boolean }>> => {
      try {
        await storageService.resetCleanupTotals();
        return { ok: true, data: { reset: true } };
      } catch (error) {
        return {
          ok: false,
          data: { reset: false },
          error: error instanceof Error ? error.message : 'Failed to reset cleanup totals.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.getScanSchedule,
    async (): Promise<IpcResponse<{ enabled: boolean; intervalMinutes: number }>> => {
      try {
        const schedule = await storageService.getScanSchedule();
        return { ok: true, data: schedule };
      } catch (error) {
        return {
          ok: false,
          data: { enabled: false, intervalMinutes: 1440 },
          error: error instanceof Error ? error.message : 'Failed to read scan schedule.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.setScanSchedule,
    async (
      _event,
      payload: { enabled?: boolean; intervalMinutes?: number }
    ): Promise<IpcResponse<{ saved: boolean }>> => {
      try {
        await storageService.setScanSchedule({
          enabled: Boolean(payload?.enabled),
          intervalMinutes:
            typeof payload?.intervalMinutes === 'number' && payload.intervalMinutes > 0
              ? payload.intervalMinutes
              : 1440
        });
        return { ok: true, data: { saved: true } };
      } catch (error) {
        return {
          ok: false,
          data: { saved: false },
          error: error instanceof Error ? error.message : 'Failed to save scan schedule.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.getScanConfig,
    async (): Promise<IpcResponse<{ roots: string[]; targets: string[]; ignore: string[] }>> => {
      try {
        const config = await storageService.getScanConfig();
        return { ok: true, data: config };
      } catch (error) {
        return {
          ok: false,
          data: { roots: [], targets: [], ignore: [] },
          error: error instanceof Error ? error.message : 'Failed to read scan config.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.setScanConfig,
    async (
      _event,
      payload: { roots?: string[]; targets?: string[]; ignore?: string[] }
    ): Promise<IpcResponse<{ saved: boolean }>> => {
      try {
        await storageService.setScanConfig({
          roots: Array.isArray(payload?.roots) ? payload?.roots : [],
          targets: Array.isArray(payload?.targets) ? payload?.targets : [],
          ignore: Array.isArray(payload?.ignore) ? payload?.ignore : []
        });
        return { ok: true, data: { saved: true } };
      } catch (error) {
        return {
          ok: false,
          data: { saved: false },
          error: error instanceof Error ? error.message : 'Failed to save scan config.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.getLastScanAt,
    async (): Promise<IpcResponse<{ lastScanAt: string | null }>> => {
      try {
        const lastScanAt = await storageService.getLastScanAt();
        return { ok: true, data: { lastScanAt } };
      } catch (error) {
        return {
          ok: false,
          data: { lastScanAt: null },
          error: error instanceof Error ? error.message : 'Failed to read last scan time.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.setLastScanAt,
    async (_event, payload: { lastScanAt?: string | null }): Promise<IpcResponse<{ saved: boolean }>> => {
      try {
        await storageService.setLastScanAt(
          typeof payload?.lastScanAt === 'string' ? payload.lastScanAt : null
        );
        return { ok: true, data: { saved: true } };
      } catch (error) {
        return {
          ok: false,
          data: { saved: false },
          error: error instanceof Error ? error.message : 'Failed to save last scan time.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.getTraySettings,
    async (): Promise<
      IpcResponse<{
        visible: boolean;
        sections: {
          disk: boolean;
          memory: boolean;
          cpu: boolean;
          battery: boolean;
          latestScan: boolean;
          warning: boolean;
        };
      }>
    > => {
      try {
        const settings = await storageService.getTraySettings();
        return { ok: true, data: settings };
      } catch (error) {
        return {
          ok: false,
          data: {
            visible: true,
            sections: {
              disk: true,
              memory: true,
              cpu: true,
              battery: true,
              latestScan: true,
              warning: true
            }
          },
          error: error instanceof Error ? error.message : 'Failed to read tray settings.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.storage.setTraySettings,
    async (
      _event,
      payload: {
        visible?: boolean;
        sections?: {
          disk?: boolean;
          memory?: boolean;
          cpu?: boolean;
          battery?: boolean;
          latestScan?: boolean;
          warning?: boolean;
        };
      }
    ): Promise<IpcResponse<{ saved: boolean }>> => {
      try {
        const existing = await storageService.getTraySettings();
        await storageService.setTraySettings({
          visible: typeof payload?.visible === 'boolean' ? payload.visible : existing.visible,
          sections: {
            disk:
              typeof payload?.sections?.disk === 'boolean' ? payload.sections.disk : existing.sections.disk,
            memory:
              typeof payload?.sections?.memory === 'boolean'
                ? payload.sections.memory
                : existing.sections.memory,
            cpu: typeof payload?.sections?.cpu === 'boolean' ? payload.sections.cpu : existing.sections.cpu,
            battery:
              typeof payload?.sections?.battery === 'boolean'
                ? payload.sections.battery
                : existing.sections.battery,
            latestScan:
              typeof payload?.sections?.latestScan === 'boolean'
                ? payload.sections.latestScan
                : existing.sections.latestScan,
            warning:
              typeof payload?.sections?.warning === 'boolean'
                ? payload.sections.warning
                : existing.sections.warning
          }
        });
        return { ok: true, data: { saved: true } };
      } catch (error) {
        return {
          ok: false,
          data: { saved: false },
          error: error instanceof Error ? error.message : 'Failed to save tray settings.'
        };
      }
    }
  );
};
