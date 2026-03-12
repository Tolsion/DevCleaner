import { create } from 'zustand';
import type { DevToolInfo } from '../../electron/shared/types/devtools';

interface DevToolsState {
  tools: DevToolInfo[];
  isLoading: boolean;
  error: string | null;
  fetchTools: () => Promise<void>;
}

export const useDevToolsStore = create<DevToolsState>((set) => ({
  tools: [],
  isLoading: false,
  error: null,
  fetchTools: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await window.devCleaner.devtools.get();
      if (!response.ok) {
        set({ error: response.error ?? 'Failed to load dev tools' });
        return;
      }
      set({ tools: response.data.filter((tool) => tool.available) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load dev tools' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
