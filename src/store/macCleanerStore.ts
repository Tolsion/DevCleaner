import { create } from 'zustand';
import type {
  LargeFileDeleteResult,
  LargeFileScanResult,
  MacJunkCleanResult,
  MacJunkSummary,
  MemoryProcessResult,
  StartupItemsResult,
  UndoTrashResult
} from '../../electron/shared/types/mac-cleaner';

interface MacCleanerState {
  junkSummary: MacJunkSummary | null;
  junkCleanResults: MacJunkCleanResult[];
  largeFiles: LargeFileScanResult | null;
  largeFileDeletes: LargeFileDeleteResult[];
  lastTrashCount: number;
  undoResults: UndoTrashResult[];
  startupItems: StartupItemsResult | null;
  memoryProcesses: MemoryProcessResult | null;
  isLoading: boolean;
  error: string | null;
  scanJunk: () => Promise<void>;
  cleanJunk: (ids: string[]) => Promise<void>;
  scanLargeFiles: (payload: { roots: string[]; minBytes: number; maxResults?: number }) => Promise<void>;
  deleteLargeFiles: (payload: { paths: string[]; roots: string[]; useTrash?: boolean }) => Promise<void>;
  undoTrash: () => Promise<void>;
  listStartupItems: () => Promise<void>;
  listMemoryProcesses: () => Promise<void>;
  terminateProcess: (pid: number) => Promise<boolean>;
}

export const useMacCleanerStore = create<MacCleanerState>((set) => ({
  junkSummary: null,
  junkCleanResults: [],
  largeFiles: null,
  largeFileDeletes: [],
  lastTrashCount: 0,
  undoResults: [],
  startupItems: null,
  memoryProcesses: null,
  isLoading: false,
  error: null,
  scanJunk: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.junkScan();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to scan junk' });
        return;
      }
      set({ junkSummary: response.data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to scan junk' });
    } finally {
      set({ isLoading: false });
    }
  },
  cleanJunk: async (ids) => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.junkClean({ ids });
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to clean junk' });
        return;
      }
      set({
        junkCleanResults: response.data,
        lastTrashCount: response.data.filter((item) => item.deleted).length,
        undoResults: []
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to clean junk' });
    } finally {
      set({ isLoading: false });
    }
  },
  scanLargeFiles: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.largeFilesScan(payload);
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to scan large files' });
        return;
      }
      set({ largeFiles: response.data, largeFileDeletes: [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to scan large files' });
    } finally {
      set({ isLoading: false });
    }
  },
  deleteLargeFiles: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.largeFilesDelete(payload);
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to delete files' });
        return;
      }
      set({
        largeFileDeletes: response.data,
        lastTrashCount: response.data.filter((item) => item.deleted).length,
        undoResults: []
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete files' });
    } finally {
      set({ isLoading: false });
    }
  },
  undoTrash: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.undoTrash();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to restore from Trash' });
        return;
      }
      set({ undoResults: response.data, lastTrashCount: 0 });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to restore from Trash' });
    } finally {
      set({ isLoading: false });
    }
  },
  listStartupItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.startupList();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to list startup items' });
        return;
      }
      set({ startupItems: response.data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to list startup items' });
    } finally {
      set({ isLoading: false });
    }
  },
  listMemoryProcesses: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.memoryList();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to list memory processes' });
        return;
      }
      set({ memoryProcesses: response.data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to list memory processes' });
    } finally {
      set({ isLoading: false });
    }
  },
  terminateProcess: async (pid) => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.macCleaner.memoryTerminate({ pid });
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to terminate process' });
        return false;
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to terminate process' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  }
}));
