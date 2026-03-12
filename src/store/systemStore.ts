import { create } from 'zustand';
import type { SystemInfo } from '../../electron/shared/types/system';

interface SystemState {
  info: SystemInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchInfo: () => Promise<void>;
  setPowerSaving: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  fetchPowerSaving: () => Promise<boolean | null>;
}

export const useSystemStore = create<SystemState>((set) => ({
  info: null,
  isLoading: false,
  error: null,
  fetchInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!window.devCleaner?.system?.get) {
        set({ error: 'System API is unavailable (preload not connected).' });
        return;
      }
      const response = await window.devCleaner.system.get();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to load system info' });
        return;
      }
      set({ info: response.data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load system info' });
    } finally {
      set({ isLoading: false });
    }
  },
  fetchPowerSaving: async () => {
    try {
      if (!window.devCleaner?.system?.getPowerSaving) {
        return null;
      }
      const response = await window.devCleaner.system.getPowerSaving();
      if (!response.ok) return null;
      return response.data.enabled;
    } catch {
      return null;
    }
  },
  setPowerSaving: async (enabled) => {
    try {
      if (!window.devCleaner?.system?.setPowerSaving) {
        return { ok: false, error: 'Power saving API is unavailable.' };
      }
      const response = await window.devCleaner.system.setPowerSaving({ enabled });
      if (!response.ok) {
        return { ok: false, error: response.error ?? 'Failed to update power saving mode.' };
      }
      set((state) => ({
        info: state.info ? { ...state.info, powerSavingEnabled: response.data.enabled } : state.info
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to update power saving mode.' };
    }
  }
}));
