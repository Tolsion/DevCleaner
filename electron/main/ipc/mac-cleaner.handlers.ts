import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import {
  LargeFileDeleteSchema,
  LargeFileScanSchema,
  MacJunkCleanSchema,
  TerminateProcessSchema
} from '../../shared/schemas/mac-cleaner';
import type { IpcResponse } from '../../shared/types/ipc';
import type {
  LargeFileDeleteResult,
  LargeFileScanResult,
  MacJunkCleanResult,
  MacJunkSummary,
  MemoryProcessResult,
  StartupItemsResult,
  UndoTrashResult
} from '../../shared/types/mac-cleaner';
import { macCleanerService } from '../services/mac-cleaner.service';

export const registerMacCleanerHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.macCleaner.junkScan, async (): Promise<IpcResponse<MacJunkSummary>> => {
    try {
      const summary = await macCleanerService.getJunkSummary();
      return { ok: true, data: summary };
    } catch (error) {
      return {
        ok: false,
        data: { scannedAt: new Date().toISOString(), categories: [], totalBytes: 0 },
        error: error instanceof Error ? error.message : 'Failed to scan junk'
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.junkClean,
    async (_event, payload): Promise<IpcResponse<MacJunkCleanResult[]>> => {
      const parsed = MacJunkCleanSchema.safeParse(payload);
      if (!parsed.success) {
        return { ok: false, data: [], error: 'Invalid cleanup payload' };
      }
      try {
        const results = await macCleanerService.cleanJunk(parsed.data.ids);
        return { ok: true, data: results };
      } catch (error) {
        return { ok: false, data: [], error: error instanceof Error ? error.message : 'Failed to clean junk' };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.largeFilesScan,
    async (_event, payload): Promise<IpcResponse<LargeFileScanResult>> => {
      const parsed = LargeFileScanSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          ok: false,
          data: { scannedAt: new Date().toISOString(), roots: [], minBytes: 0, files: [] },
          error: 'Invalid large files payload'
        };
      }
      try {
        const result = await macCleanerService.scanLargeFiles(
          parsed.data.roots,
          parsed.data.minBytes,
          parsed.data.maxResults
        );
        return { ok: true, data: result };
      } catch (error) {
        return {
          ok: false,
          data: { scannedAt: new Date().toISOString(), roots: parsed.data.roots, minBytes: 0, files: [] },
          error: error instanceof Error ? error.message : 'Failed to scan large files'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.largeFilesDelete,
    async (_event, payload): Promise<IpcResponse<LargeFileDeleteResult[]>> => {
      const parsed = LargeFileDeleteSchema.safeParse(payload);
      if (!parsed.success) {
        return { ok: false, data: [], error: 'Invalid delete payload' };
      }
      try {
        const result = await macCleanerService.deleteLargeFiles(
          parsed.data.paths,
          parsed.data.roots,
          parsed.data.useTrash ?? true
        );
        return { ok: true, data: result };
      } catch (error) {
        return { ok: false, data: [], error: error instanceof Error ? error.message : 'Failed to delete files' };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.macCleaner.undoTrash, async (): Promise<IpcResponse<UndoTrashResult[]>> => {
    try {
      const result = await macCleanerService.undoTrash();
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to restore from Trash'
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.startupList,
    async (): Promise<IpcResponse<StartupItemsResult>> => {
      try {
        const result = await macCleanerService.listStartupItems();
        return { ok: true, data: result };
      } catch (error) {
        return {
          ok: false,
          data: { scannedAt: new Date().toISOString(), items: [] },
          error: error instanceof Error ? error.message : 'Failed to list startup items'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.memoryList,
    async (): Promise<IpcResponse<MemoryProcessResult>> => {
      try {
        const result = await macCleanerService.listMemoryProcesses();
        return { ok: true, data: result };
      } catch (error) {
        return {
          ok: false,
          data: { sampledAt: new Date().toISOString(), processes: [] },
          error: error instanceof Error ? error.message : 'Failed to list processes'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.macCleaner.memoryTerminate,
    async (_event, payload): Promise<IpcResponse<{ terminated: boolean }>> => {
      const parsed = TerminateProcessSchema.safeParse(payload);
      if (!parsed.success) {
        return { ok: false, data: { terminated: false }, error: 'Invalid terminate payload' };
      }
      const result = await macCleanerService.terminateProcess(parsed.data.pid);
      if (!result.terminated) {
        return { ok: false, data: { terminated: false }, error: result.error ?? 'Failed to terminate' };
      }
      return { ok: true, data: { terminated: true } };
    }
  );
};
