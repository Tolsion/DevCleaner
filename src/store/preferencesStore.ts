import { create } from 'zustand';

const TRAY_SETTINGS_KEY = 'devcleaner:traySettings';

export type TraySettings = {
  visible: boolean;
  sections: {
    disk: boolean;
    memory: boolean;
    cpu: boolean;
    battery: boolean;
    latestScan: boolean;
    warning: boolean;
  };
};

const DEFAULT_TRAY_SETTINGS: TraySettings = {
  visible: true,
  sections: {
    disk: true,
    memory: true,
    cpu: true,
    battery: true,
    latestScan: true,
    warning: true
  }
};

const loadTraySettings = (): TraySettings | null => {
  try {
    const raw = window.localStorage.getItem(TRAY_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.visible !== 'boolean') return null;
    return {
      visible: parsed.visible,
      sections: {
        disk: Boolean(parsed.sections?.disk),
        memory: Boolean(parsed.sections?.memory),
        cpu: Boolean(parsed.sections?.cpu),
        battery: Boolean(parsed.sections?.battery),
        latestScan: Boolean(parsed.sections?.latestScan),
        warning: Boolean(parsed.sections?.warning)
      }
    };
  } catch {
    return null;
  }
};

const saveTraySettings = (settings: TraySettings) => {
  try {
    window.localStorage.setItem(TRAY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore persistence failures
  }
};

interface PreferencesState {
  traySettings: TraySettings;
  hydrateTraySettings: () => Promise<void>;
  setTraySettings: (settings: TraySettings) => Promise<void>;
  setTrayVisible: (visible: boolean) => Promise<void>;
  toggleTraySection: (key: keyof TraySettings['sections'], enabled: boolean) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  traySettings: DEFAULT_TRAY_SETTINGS,
  hydrateTraySettings: async () => {
    if (window.devCleaner?.storage?.getTraySettings) {
      try {
        const response = await window.devCleaner.storage.getTraySettings();
        if (response.ok) {
          set({ traySettings: response.data });
          saveTraySettings(response.data);
          return;
        }
      } catch {
        // fall back to local storage
      }
    }
    const fallback = loadTraySettings();
    if (fallback) {
      set({ traySettings: fallback });
    }
  },
  setTraySettings: async (settings) => {
    set({ traySettings: settings });
    saveTraySettings(settings);
    if (window.devCleaner?.storage?.setTraySettings) {
      try {
        await window.devCleaner.storage.setTraySettings(settings);
      } catch {
        // ignore
      }
    }
  },
  setTrayVisible: async (visible) => {
    const next = { ...get().traySettings, visible };
    await get().setTraySettings(next);
    if (window.devCleaner?.app?.setTrayVisible) {
      try {
        await window.devCleaner.app.setTrayVisible({ visible });
      } catch {
        // ignore
      }
    }
  },
  toggleTraySection: async (key, enabled) => {
    const current = get().traySettings;
    const next = {
      ...current,
      sections: {
        ...current.sections,
        [key]: enabled
      }
    };
    await get().setTraySettings(next);
  }
}));
