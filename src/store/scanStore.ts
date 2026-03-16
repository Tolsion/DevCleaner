import { create } from 'zustand';
import type {
  ScanProgress,
  ScanResultItem,
  ScanResults,
  ScanStartPayload
} from '../../electron/shared/types/scan';

const emptyResults: ScanResults = {
  scannedAt: null,
  items: [],
  generalAnalysis: {
    scannedFileCount: 0,
    scannedDirectoryCount: 0,
    totalScannedBytes: 0,
    totalMediaBytes: 0,
    staleThresholdDays: 180,
    largeFileThresholdBytes: 250 * 1024 * 1024,
    largeFiles: [],
    oldestFiles: [],
    staleFiles: [],
    mediaSummary: [],
    applications: []
  }
};

const TOTALS_KEY = 'devcleaner:cleanupTotals';
const TARGETS_KEY = 'devcleaner:scanTargets';
const SCHEDULE_KEY = 'devcleaner:scanSchedule';

const loadTargets = () => {
  try {
    const raw = window.localStorage.getItem(TARGETS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
};

const saveTargets = (targets: string[]) => {
  try {
    window.localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  } catch {
    // ignore persistence failures
  }
};

const loadSchedule = () => {
  try {
    const raw = window.localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.enabled === 'boolean' &&
      typeof parsed?.intervalMinutes === 'number'
    ) {
      return parsed as { enabled: boolean; intervalMinutes: number };
    }
    return null;
  } catch {
    return null;
  }
};

const saveSchedule = (schedule: { enabled: boolean; intervalMinutes: number }) => {
  try {
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  } catch {
    // ignore persistence failures
  }
};

const persistScanConfig = async (config: {
  roots: string[];
  targets: string[];
  ignore: string[];
}) => {
  if (window.devCleaner?.storage?.setScanConfig) {
    try {
      await window.devCleaner.storage.setScanConfig(config);
      return;
    } catch {
      // fall back to local storage
    }
  }
};

const loadTotals = () => {
  try {
    const raw = window.localStorage.getItem(TOTALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.totalCleanedBytes === 'number' &&
      typeof parsed?.totalCleanedFolders === 'number' &&
      typeof parsed?.totalCleanedProjects === 'number'
    ) {
      return parsed as {
        totalCleanedBytes: number;
        totalCleanedFolders: number;
        totalCleanedProjects: number;
      };
    }
    return null;
  } catch {
    return null;
  }
};

const saveTotals = (totals: {
  totalCleanedBytes: number;
  totalCleanedFolders: number;
  totalCleanedProjects: number;
}) => {
  try {
    window.localStorage.setItem(TOTALS_KEY, JSON.stringify(totals));
  } catch {
    // ignore persistence failures
  }
};

const persistTotals = async (totals: {
  totalCleanedBytes: number;
  totalCleanedFolders: number;
  totalCleanedProjects: number;
}) => {
  if (window.devCleaner?.storage?.setCleanupTotals) {
    try {
      const response = await window.devCleaner.storage.setCleanupTotals(totals);
      if (response.ok) {
        saveTotals(totals);
        return;
      }
    } catch {
      // fall back to local storage
    }
  }
  saveTotals(totals);
};

interface ScanState {
  isScanning: boolean;
  lastScanAt: string | null;
  progress: ScanProgress | null;
  results: ScanResults;
  roots: string[];
  targets: string[];
  ignore: string[];
  lastCleanupBytes: number;
  lastCleanupAt: number | null;
  totalCleanedBytes: number;
  totalCleanedFolders: number;
  totalCleanedProjects: number;
  history: Array<{
    scannedAt: string | null;
    totalBytes: number;
    totalProjects: number;
    totalFolders: number;
  }>;
  isCleaning: boolean;
  cleanupProgress: {
    percent: number;
    cleanedBytes: number;
    totalBytes: number;
    cleanedTargets: number;
    totalTargets: number;
    startedAt: number;
  } | null;
  scanStartedAt: number | null;
  overlayHidden: boolean;
  scanPaused: boolean;
  cleaningPaused: boolean;
  scanError: string | null;
  scheduleEnabled: boolean;
  scheduleIntervalMinutes: number;
  startScan: (payload: ScanStartPayload) => Promise<void>;
  refreshResults: () => Promise<void>;
  cancelScan: () => Promise<void>;
  pauseScan: () => Promise<void>;
  resumeScan: () => Promise<void>;
  setRoots: (roots: string[]) => void;
  setTargets: (targets: string[]) => void;
  setIgnore: (ignore: string[]) => void;
  deleteJunk: (rootPath: string, junkFolders: string[]) => Promise<void>;
  deleteItems: (items: ScanResultItem[]) => Promise<void>;
  cancelCleaning: () => void;
  hideOverlay: () => void;
  showOverlay: () => void;
  pauseCleaning: () => void;
  resumeCleaning: () => void;
  setScanError: (error: string | null) => void;
  setScanSchedule: (payload: { enabled: boolean; intervalMinutes: number }) => void;
  hydrateSchedule: () => Promise<void>;
  hydrateScanConfig: () => Promise<void>;
  hydrateTotals: () => Promise<void>;
  resetTotals: () => Promise<void>;
}

export const useScanStore = create<ScanState>((set) => {
  const persisted = typeof window !== 'undefined' ? loadTotals() : null;
  const persistedTargets = typeof window !== 'undefined' ? loadTargets() : null;
  const persistedSchedule = typeof window !== 'undefined' ? loadSchedule() : null;
  return {
    isScanning: false,
    lastScanAt: null,
    progress: null,
    results: emptyResults,
    roots: ['~/Projects'],
    targets:
      persistedTargets ??
      ['node_modules', '.next', 'dist', 'build', '.turbo', '.cache', 'coverage'],
    ignore: [],
    lastCleanupBytes: 0,
    lastCleanupAt: null,
    totalCleanedBytes: persisted?.totalCleanedBytes ?? 0,
    totalCleanedFolders: persisted?.totalCleanedFolders ?? 0,
    totalCleanedProjects: persisted?.totalCleanedProjects ?? 0,
    history: [],
    isCleaning: false,
    cleanupProgress: null,
    scanStartedAt: null,
    overlayHidden: false,
    scanPaused: false,
    cleaningPaused: false,
    scanError: null,
    scheduleEnabled: persistedSchedule?.enabled ?? false,
    scheduleIntervalMinutes: persistedSchedule?.intervalMinutes ?? 10,
    setScanError: (error) => set({ scanError: error }),
    setRoots: (roots) => {
      set({ roots });
      void persistScanConfig({
        roots,
        targets: useScanStore.getState().targets,
        ignore: useScanStore.getState().ignore
      });
    },
    setTargets: (targets) => {
      saveTargets(targets);
      set({ targets });
      void persistScanConfig({
        roots: useScanStore.getState().roots,
        targets,
        ignore: useScanStore.getState().ignore
      });
    },
    setIgnore: (ignore) => {
      set({ ignore });
      void persistScanConfig({
        roots: useScanStore.getState().roots,
        targets: useScanStore.getState().targets,
        ignore
      });
    },
    setScanSchedule: (payload) => {
      saveSchedule(payload);
      set({
        scheduleEnabled: payload.enabled,
        scheduleIntervalMinutes: payload.intervalMinutes
      });
      if (window.devCleaner?.storage?.setScanSchedule) {
        void window.devCleaner.storage.setScanSchedule(payload);
      }
    },
    hydrateTotals: async () => {
      if (window.devCleaner?.storage?.getCleanupTotals) {
        try {
          const response = await window.devCleaner.storage.getCleanupTotals();
          if (response.ok) {
            set({
              totalCleanedBytes: response.data.totalCleanedBytes,
              totalCleanedFolders: response.data.totalCleanedFolders,
              totalCleanedProjects: response.data.totalCleanedProjects
            });
            saveTotals(response.data);
            return;
          }
        } catch {
          // fall back to local storage
        }
      }
      const fallback = loadTotals();
      if (fallback) {
        set({
          totalCleanedBytes: fallback.totalCleanedBytes,
          totalCleanedFolders: fallback.totalCleanedFolders,
          totalCleanedProjects: fallback.totalCleanedProjects
        });
      }
    },
    hydrateSchedule: async () => {
      if (window.devCleaner?.storage?.getScanSchedule) {
        try {
          const response = await window.devCleaner.storage.getScanSchedule();
          if (response.ok) {
            set({
              scheduleEnabled: response.data.enabled,
              scheduleIntervalMinutes: response.data.intervalMinutes
            });
            saveSchedule(response.data);
            return;
          }
        } catch {
          // fall back to local storage
        }
      }
      const fallback = loadSchedule();
      if (fallback) {
        set({
          scheduleEnabled: fallback.enabled,
          scheduleIntervalMinutes: fallback.intervalMinutes
        });
      }
    },
    hydrateScanConfig: async () => {
      if (window.devCleaner?.storage?.getScanConfig) {
        try {
          const response = await window.devCleaner.storage.getScanConfig();
          if (response.ok) {
            const { roots, targets, ignore } = response.data;
            if (roots.length || targets.length || ignore.length) {
              set({
                roots: roots.length ? roots : useScanStore.getState().roots,
                targets: targets.length ? targets : useScanStore.getState().targets,
                ignore
              });
              return;
            }
          }
        } catch {
          // ignore
        }
      }
      void persistScanConfig({
        roots: useScanStore.getState().roots,
        targets: useScanStore.getState().targets,
        ignore: useScanStore.getState().ignore
      });
    },
    resetTotals: async () => {
      if (window.devCleaner?.storage?.resetCleanupTotals) {
        try {
          await window.devCleaner.storage.resetCleanupTotals();
        } catch {
          // ignore
        }
      }
      const totals = { totalCleanedBytes: 0, totalCleanedFolders: 0, totalCleanedProjects: 0 };
      set(totals);
      saveTotals(totals);
    },
    startScan: async (payload) => {
    if (!window.devCleaner?.scan?.start || !window.devCleaner?.scan?.onProgress) {
      set({ scanError: 'Scan API is unavailable (preload not connected).', isScanning: false });
      return;
    }
    if (!payload.roots?.length) {
      set({ scanError: 'No scan roots selected.', isScanning: false });
      return;
    }
    set({
      isScanning: true,
      scanError: null,
      progress: {
        phase: 'scanning',
        percent: 0,
        foundCount: 0,
        message: 'Starting scan...'
      },
      scanStartedAt: Date.now(),
      overlayHidden: false,
      scanPaused: false
    });
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = window.devCleaner.scan.onProgress((progress) => {
        set({ progress });
      });
    } catch (error) {
      set({
        scanError: error instanceof Error ? error.message : 'Failed to attach scan progress listener',
        isScanning: false
      });
      return;
    }
    try {
      const response = await window.devCleaner.scan.start(payload);
      if (response.ok) {
        const totalBytes = response.data.items.reduce((sum, item) => sum + item.junkSizeBytes, 0);
        const totalProjects = response.data.items.length;
        const totalFolders = response.data.items.reduce((sum, item) => sum + item.junkFolders.length, 0);
        set({
          results: response.data,
          lastScanAt: response.data.scannedAt,
          history: [
            {
              scannedAt: response.data.scannedAt,
              totalBytes,
              totalProjects,
              totalFolders
            },
            ...useScanStore.getState().history
          ].slice(0, 10)
        });
      } else {
        set({ scanError: response.error ?? 'Scan failed.' });
      }
    } finally {
      unsubscribe?.();
      set({ isScanning: false, scanPaused: false });
    }
  },
  refreshResults: async () => {
    if (!window.devCleaner?.scan?.getResults) {
      set({ scanError: 'Scan API is unavailable (preload not connected).' });
      return;
    }
    try {
      const response = await window.devCleaner.scan.getResults();
      if (response.ok) {
        const totalBytes = response.data.items.reduce((sum, item) => sum + item.junkSizeBytes, 0);
        const totalProjects = response.data.items.length;
        const totalFolders = response.data.items.reduce((sum, item) => sum + item.junkFolders.length, 0);
        set({
          results: response.data,
          lastScanAt: response.data.scannedAt,
          history: [
            {
              scannedAt: response.data.scannedAt,
              totalBytes,
              totalProjects,
              totalFolders
            },
            ...useScanStore.getState().history
          ].slice(0, 10)
        });
      } else {
        set({ scanError: response.error ?? 'Failed to load scan results.' });
      }
    } catch {
      // ignore
    }
  },
  cancelScan: async () => {
    if (!useScanStore.getState().isScanning) return;
    if (!window.devCleaner?.scan?.cancel) {
      set({ scanError: 'Scan API is unavailable (preload not connected).', isScanning: false });
      return;
    }
    await window.devCleaner.scan.cancel();
    set({ isScanning: false, progress: null, scanPaused: false });
  },
  pauseScan: async () => {
    if (!useScanStore.getState().isScanning) return;
    if (!window.devCleaner?.scan?.pause) {
      set({ scanError: 'Scan API is unavailable (preload not connected).' });
      return;
    }
    await window.devCleaner.scan.pause();
    set({ scanPaused: true });
  },
  resumeScan: async () => {
    if (!useScanStore.getState().isScanning) return;
    if (!window.devCleaner?.scan?.resume) {
      set({ scanError: 'Scan API is unavailable (preload not connected).' });
      return;
    }
    await window.devCleaner.scan.resume();
    set({ scanPaused: false });
  },
  deleteJunk: async (rootPath, junkFolders) => {
    const targetItem = useScanStore
      .getState()
      .results.items.find((item) => item.rootPath === rootPath);
    if (!targetItem) return;
    await useScanStore.getState().deleteItems([targetItem]);
  },
  deleteItems: async (items) => {
    if (items.length === 0) return;
    const totalBytes = items.reduce((sum, item) => sum + item.junkSizeBytes, 0);
    const totalTargets = items.reduce((sum, item) => sum + item.junkFolders.length, 0);
    const startedAt = Date.now();
    set({
      isCleaning: true,
      cleanupProgress: {
        percent: 0,
        cleanedBytes: 0,
        totalBytes,
        cleanedTargets: 0,
        totalTargets,
        startedAt
      },
      overlayHidden: false,
      cleaningPaused: false
    });

    let aborted = false;
    let cleanedTargets = 0;
    let cleanedBytes = 0;
    const cleanedRoots = new Set<string>();
    for (const item of items) {
      if (useScanStore.getState().cleanupProgress === null) {
        aborted = true;
        break;
      }
      while (useScanStore.getState().cleaningPaused) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      const perFolderBytes = item.junkFolders.length
        ? item.junkSizeBytes / item.junkFolders.length
        : item.junkSizeBytes;
      for (const folder of item.junkFolders) {
        if (useScanStore.getState().cleanupProgress === null) {
          aborted = true;
          break;
        }
        while (useScanStore.getState().cleaningPaused) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const targetPath = `${item.rootPath}/${folder}`;
        await window.devCleaner.folders.delete(targetPath);
        cleanedTargets += 1;
        cleanedBytes += perFolderBytes;
        const percent = totalTargets
          ? Math.min(100, Math.round((cleanedTargets / totalTargets) * 100))
          : 100;
        set({
          cleanupProgress: {
            percent,
            cleanedBytes,
            totalBytes,
            cleanedTargets,
            totalTargets,
            startedAt
          }
        });
      }
      if (aborted) break;
      cleanedRoots.add(item.rootPath);
    }

    let totalsForPersist = {
      totalCleanedBytes: 0,
      totalCleanedFolders: 0,
      totalCleanedProjects: 0
    };
    set((state) => {
      const totals = {
        totalCleanedBytes: state.totalCleanedBytes + cleanedBytes,
        totalCleanedFolders: state.totalCleanedFolders + cleanedTargets,
        totalCleanedProjects: state.totalCleanedProjects + cleanedRoots.size
      };
      totalsForPersist = totals;
      const nextState = {
        results: {
          ...state.results,
          items: state.results.items.filter(
            (item) => !cleanedRoots.has(item.rootPath)
          )
        },
        lastCleanupBytes: cleanedBytes,
        lastCleanupAt: Date.now(),
        totalCleanedBytes: totals.totalCleanedBytes,
        totalCleanedFolders: totals.totalCleanedFolders,
        totalCleanedProjects: totals.totalCleanedProjects,
        isCleaning: false,
        cleanupProgress: null,
        overlayHidden: false,
        cleaningPaused: false
      } as const;
      return nextState;
    });
    await persistTotals(totalsForPersist);
  },
  cancelCleaning: () => {
    if (!useScanStore.getState().isCleaning) return;
    set({
      isCleaning: false,
      cleanupProgress: null,
      overlayHidden: false,
      cleaningPaused: false
    });
  },
  hideOverlay: () => set({ overlayHidden: true }),
  showOverlay: () => set({ overlayHidden: false }),
  pauseCleaning: () => {
    if (!useScanStore.getState().isCleaning) return;
    set({ cleaningPaused: true });
  },
  resumeCleaning: () => {
    if (!useScanStore.getState().isCleaning) return;
    set({ cleaningPaused: false });
  }
};
});
