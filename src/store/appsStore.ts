import { create } from 'zustand';
import type { AppInfo, AppsListResponse } from '../../electron/shared/types/apps';

interface AppsState {
  apps: AppInfo[];
  supported: boolean;
  isLoading: boolean;
  error: string | null;
  fetchApps: () => Promise<void>;
  uninstallApp: (path: string) => Promise<boolean>;
  revealApp: (path: string) => Promise<boolean>;
}

export const useAppsStore = create<AppsState>((set) => ({
  apps: [],
  supported: true,
  isLoading: false,
  error: null,
  fetchApps: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!window.devCleaner?.apps?.list) {
        set({ error: 'Apps API is unavailable (preload not connected).' });
        return;
      }
      const response = await window.devCleaner.apps.list();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to load apps.' });
        return;
      }
      const data = response.data as AppsListResponse;
      set({ apps: data.apps, supported: data.supported });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load apps.' });
    } finally {
      set({ isLoading: false });
    }
  },
  uninstallApp: async (appPath) => {
    try {
      if (!window.devCleaner?.apps?.uninstall) {
        set({ error: 'Apps API is unavailable (preload not connected).' });
        return false;
      }
      const response = await window.devCleaner.apps.uninstall({ path: appPath });
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to remove app.' });
        return false;
      }
      set((state) => ({
        apps: state.apps.filter((app) => app.path !== appPath)
      }));
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove app.' });
      return false;
    }
  },
  revealApp: async (appPath) => {
    try {
      if (!window.devCleaner?.apps?.showInFinder) {
        set({ error: 'Apps API is unavailable (preload not connected).' });
        return false;
      }
      const response = await window.devCleaner.apps.showInFinder({ path: appPath });
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to reveal app.' });
        return false;
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reveal app.' });
      return false;
    }
  }
}));
