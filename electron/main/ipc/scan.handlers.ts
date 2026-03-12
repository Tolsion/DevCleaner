import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import { ScanStartSchema } from '../../shared/schemas/scan';
import type { IpcResponse } from '../../shared/types/ipc';
import type { ScanProgress, ScanResults } from '../../shared/types/scan';
import { scannerService } from '../services/scanner.service';
import { storageService } from '../services/storage.service';

let lastResults: ScanResults = {
  scannedAt: null,
  items: []
};

let currentAbort: { aborted: boolean } | null = null;
let currentPause: { paused: boolean } | null = null;
let isScanning = false;

export const getIsScanning = () => isScanning;
export const setLastResults = (results: ScanResults) => {
  lastResults = results;
};

export const registerScanHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.scan.start, async (event, payload): Promise<IpcResponse<ScanResults>> => {
    const parsed = ScanStartSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        data: lastResults,
        error: 'Invalid scan payload'
      };
    }

    currentAbort = { aborted: false };
    currentPause = { paused: false };
    isScanning = true;
    const onProgress = (progress: ScanProgress) => {
      event.sender.send(IPC_CHANNELS.scan.progress, progress);
    };

    try {
      lastResults = await scannerService.scan(
        parsed.data,
        onProgress,
        () => currentAbort?.aborted ?? false,
        () => currentPause?.paused ?? false
      );
      await storageService.setLastScanAt(lastResults.scannedAt);
      return {
        ok: true,
        data: lastResults
      };
    } catch (error) {
      return {
        ok: false,
        data: lastResults,
        error: error instanceof Error ? error.message : 'Scan cancelled'
      };
    } finally {
      currentAbort = null;
      currentPause = null;
      isScanning = false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.scan.getResults, async (): Promise<IpcResponse<ScanResults>> => {
    return {
      ok: true,
      data: lastResults
    };
  });

  ipcMain.handle(IPC_CHANNELS.scan.cancel, async (): Promise<IpcResponse<{ cancelled: boolean }>> => {
    if (currentAbort) {
      currentAbort.aborted = true;
      return { ok: true, data: { cancelled: true } };
    }
    return { ok: true, data: { cancelled: false } };
  });

  ipcMain.handle(IPC_CHANNELS.scan.pause, async (): Promise<IpcResponse<{ paused: boolean }>> => {
    if (currentPause) {
      currentPause.paused = true;
      return { ok: true, data: { paused: true } };
    }
    return { ok: true, data: { paused: false } };
  });

  ipcMain.handle(IPC_CHANNELS.scan.resume, async (): Promise<IpcResponse<{ resumed: boolean }>> => {
    if (currentPause) {
      currentPause.paused = false;
      return { ok: true, data: { resumed: true } };
    }
    return { ok: true, data: { resumed: false } };
  });
};
