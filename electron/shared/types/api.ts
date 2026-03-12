import type { IpcResponse } from './ipc';
import type { ScanProgress, ScanResults, ScanStartPayload } from './scan';
import type { SystemInfo } from './system';
import type { DevToolInfo } from './devtools';
import type { AppInfo, AppsListResponse } from './apps';
import type {
  LargeFileScanResult,
  LargeFileDeleteResult,
  MacJunkCleanResult,
  MacJunkSummary,
  MemoryProcessResult,
  StartupItemsResult,
  MacJunkCategoryId,
  UndoTrashResult
} from './mac-cleaner';

export interface DevCleanerApi {
  scan: {
    start: (payload: ScanStartPayload) => Promise<IpcResponse<ScanResults>>;
    getResults: () => Promise<IpcResponse<ScanResults>>;
    onProgress: (callback: (payload: ScanProgress) => void) => () => void;
    cancel: () => Promise<IpcResponse<{ cancelled: boolean }>>;
    pause: () => Promise<IpcResponse<{ paused: boolean }>>;
    resume: () => Promise<IpcResponse<{ resumed: boolean }>>;
  };
  system: {
    get: () => Promise<IpcResponse<SystemInfo>>;
    getPowerSaving: () => Promise<IpcResponse<{ enabled: boolean | null }>>;
    setPowerSaving: (payload: { enabled: boolean }) => Promise<IpcResponse<{ enabled: boolean }>>;
  };
  macCleaner: {
    junkScan: () => Promise<IpcResponse<MacJunkSummary>>;
    junkClean: (payload: { ids: MacJunkCategoryId[] }) => Promise<IpcResponse<MacJunkCleanResult[]>>;
    largeFilesScan: (payload: {
      roots: string[];
      minBytes: number;
      maxResults?: number;
    }) => Promise<IpcResponse<LargeFileScanResult>>;
    largeFilesDelete: (payload: {
      paths: string[];
      roots: string[];
      useTrash?: boolean;
    }) => Promise<IpcResponse<LargeFileDeleteResult[]>>;
    undoTrash: () => Promise<IpcResponse<UndoTrashResult[]>>;
    startupList: () => Promise<IpcResponse<StartupItemsResult>>;
    memoryList: () => Promise<IpcResponse<MemoryProcessResult>>;
    memoryTerminate: (payload: { pid: number }) => Promise<IpcResponse<{ terminated: boolean }>>;
  };
  folders: {
    pick: () => Promise<IpcResponse<string[]>>;
    delete: (targetPath: string) => Promise<IpcResponse<{ success: boolean }>>;
  };
  devtools: {
    get: () => Promise<IpcResponse<DevToolInfo[]>>;
  };
  apps: {
    list: () => Promise<IpcResponse<AppsListResponse>>;
    uninstall: (payload: { path: string }) => Promise<IpcResponse<{ removed: boolean }>>;
    showInFinder: (payload: { path: string }) => Promise<IpcResponse<{ shown: boolean }>>;
  };
  app: {
    showMain: () => Promise<IpcResponse<{ shown: boolean }>>;
    hideTray: () => Promise<IpcResponse<{ hidden: boolean }>>;
    onNavigate: (callback: (payload: { page: string }) => void) => () => void;
    navigate: (payload: { page: string }) => Promise<IpcResponse<{ navigated: boolean }>>;
    quit: () => Promise<IpcResponse<{ quit: boolean }>>;
    setTrayVisible: (payload: { visible: boolean }) => Promise<IpcResponse<{ visible: boolean }>>;
  };
  storage: {
    getCleanupTotals: () => Promise<IpcResponse<{
      totalCleanedBytes: number;
      totalCleanedFolders: number;
      totalCleanedProjects: number;
    }>>;
    setCleanupTotals: (payload: {
      totalCleanedBytes: number;
      totalCleanedFolders: number;
      totalCleanedProjects: number;
    }) => Promise<IpcResponse<{ saved: boolean }>>;
    resetCleanupTotals: () => Promise<IpcResponse<{ reset: boolean }>>;
    getScanSchedule: () => Promise<IpcResponse<{ enabled: boolean; intervalMinutes: number }>>;
    setScanSchedule: (payload: {
      enabled: boolean;
      intervalMinutes: number;
    }) => Promise<IpcResponse<{ saved: boolean }>>;
    getScanConfig: () => Promise<IpcResponse<{ roots: string[]; targets: string[]; ignore: string[] }>>;
    setScanConfig: (payload: {
      roots: string[];
      targets: string[];
      ignore: string[];
    }) => Promise<IpcResponse<{ saved: boolean }>>;
    getLastScanAt: () => Promise<IpcResponse<{ lastScanAt: string | null }>>;
    setLastScanAt: (payload: { lastScanAt: string | null }) => Promise<IpcResponse<{ saved: boolean }>>;
    getTraySettings: () => Promise<IpcResponse<{
      visible: boolean;
      sections: {
        disk: boolean;
        memory: boolean;
        cpu: boolean;
        battery: boolean;
        latestScan: boolean;
        warning: boolean;
      };
    }>>;
    setTraySettings: (payload: {
      visible?: boolean;
      sections?: {
        disk?: boolean;
        memory?: boolean;
        cpu?: boolean;
        battery?: boolean;
        latestScan?: boolean;
        warning?: boolean;
      };
    }) => Promise<IpcResponse<{ saved: boolean }>>;
  };
}
