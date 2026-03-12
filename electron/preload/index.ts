import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/ipc';
import type { DevCleanerApi } from '../shared/types/api';

const api: DevCleanerApi = {
  scan: {
    start: (payload) => ipcRenderer.invoke(IPC_CHANNELS.scan.start, payload),
    getResults: () => ipcRenderer.invoke(IPC_CHANNELS.scan.getResults),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.scan.cancel),
    pause: () => ipcRenderer.invoke(IPC_CHANNELS.scan.pause),
    resume: () => ipcRenderer.invoke(IPC_CHANNELS.scan.resume),
    onProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        callback(payload as Parameters<typeof callback>[0]);
      };
      ipcRenderer.on(IPC_CHANNELS.scan.progress, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.scan.progress, handler);
      };
    }
  },
  system: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.system.get),
    getPowerSaving: () => ipcRenderer.invoke(IPC_CHANNELS.system.getPowerSaving),
    setPowerSaving: (payload) => ipcRenderer.invoke(IPC_CHANNELS.system.setPowerSaving, payload)
  },
  macCleaner: {
    junkScan: () => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.junkScan),
    junkClean: (payload) => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.junkClean, payload),
    largeFilesScan: (payload) => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.largeFilesScan, payload),
    largeFilesDelete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.largeFilesDelete, payload),
    undoTrash: () => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.undoTrash),
    startupList: () => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.startupList),
    memoryList: () => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.memoryList),
    memoryTerminate: (payload) => ipcRenderer.invoke(IPC_CHANNELS.macCleaner.memoryTerminate, payload)
  },
  folders: {
    pick: () => ipcRenderer.invoke(IPC_CHANNELS.folders.pick),
    delete: (targetPath) => ipcRenderer.invoke(IPC_CHANNELS.folders.delete, targetPath)
  },
  devtools: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.devtools.get)
  },
  apps: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.apps.list),
    uninstall: (payload) => ipcRenderer.invoke(IPC_CHANNELS.apps.uninstall, payload),
    showInFinder: (payload) => ipcRenderer.invoke(IPC_CHANNELS.apps.showInFinder, payload)
  },
  app: {
    showMain: () => ipcRenderer.invoke(IPC_CHANNELS.app.showMain),
    hideTray: () => ipcRenderer.invoke(IPC_CHANNELS.app.hideTray),
    onNavigate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        callback(payload as Parameters<typeof callback>[0]);
      };
      ipcRenderer.on(IPC_CHANNELS.app.navigate, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.app.navigate, handler);
      };
    },
    navigate: (payload) => ipcRenderer.invoke(IPC_CHANNELS.app.navigate, payload),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.app.quit),
    setTrayVisible: (payload) => ipcRenderer.invoke(IPC_CHANNELS.app.setTrayVisible, payload)
  },
  storage: {
    getCleanupTotals: () => ipcRenderer.invoke(IPC_CHANNELS.storage.getCleanupTotals),
    setCleanupTotals: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.setCleanupTotals, payload),
    resetCleanupTotals: () => ipcRenderer.invoke(IPC_CHANNELS.storage.resetCleanupTotals),
    getScanSchedule: () => ipcRenderer.invoke(IPC_CHANNELS.storage.getScanSchedule),
    setScanSchedule: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.setScanSchedule, payload),
    getScanConfig: () => ipcRenderer.invoke(IPC_CHANNELS.storage.getScanConfig),
    setScanConfig: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.setScanConfig, payload),
    getLastScanAt: () => ipcRenderer.invoke(IPC_CHANNELS.storage.getLastScanAt),
    setLastScanAt: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.setLastScanAt, payload),
    getTraySettings: () => ipcRenderer.invoke(IPC_CHANNELS.storage.getTraySettings),
    setTraySettings: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.setTraySettings, payload)
  }
};

contextBridge.exposeInMainWorld('devCleaner', api);
