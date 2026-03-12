import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CleanupTotals = {
  totalCleanedBytes: number;
  totalCleanedFolders: number;
  totalCleanedProjects: number;
};

type ScanSchedule = {
  enabled: boolean;
  intervalMinutes: number;
};

type ScanConfig = {
  roots: string[];
  targets: string[];
  ignore: string[];
};

type TraySettings = {
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

type StorageShape = {
  cleanupTotals: CleanupTotals;
  scanSchedule: ScanSchedule;
  scanConfig: ScanConfig;
  lastScanAt: string | null;
  traySettings: TraySettings;
};

const DEFAULT_TOTALS: CleanupTotals = {
  totalCleanedBytes: 0,
  totalCleanedFolders: 0,
  totalCleanedProjects: 0
};

const DEFAULT_SCHEDULE: ScanSchedule = {
  enabled: false,
  intervalMinutes: 10
};

const DEFAULT_SCAN_CONFIG: ScanConfig = {
  roots: [],
  targets: [],
  ignore: []
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

const normalizeTotals = (input: unknown): CleanupTotals => {
  const data = input as Partial<CleanupTotals> | null;
  return {
    totalCleanedBytes: typeof data?.totalCleanedBytes === 'number' ? data.totalCleanedBytes : 0,
    totalCleanedFolders: typeof data?.totalCleanedFolders === 'number' ? data.totalCleanedFolders : 0,
    totalCleanedProjects: typeof data?.totalCleanedProjects === 'number' ? data.totalCleanedProjects : 0
  };
};

const normalizeStore = (input: unknown): StorageShape => {
  const data = input as Partial<StorageShape> | null;
  return {
    cleanupTotals: normalizeTotals(data?.cleanupTotals),
    scanSchedule: {
      enabled: typeof data?.scanSchedule?.enabled === 'boolean' ? data.scanSchedule.enabled : false,
      intervalMinutes:
        typeof data?.scanSchedule?.intervalMinutes === 'number' && data.scanSchedule.intervalMinutes > 0
          ? data.scanSchedule.intervalMinutes
          : DEFAULT_SCHEDULE.intervalMinutes
    },
    scanConfig: {
      roots: Array.isArray(data?.scanConfig?.roots) ? data.scanConfig?.roots.filter((v) => typeof v === 'string') : [],
      targets: Array.isArray(data?.scanConfig?.targets)
        ? data.scanConfig?.targets.filter((v) => typeof v === 'string')
        : [],
      ignore: Array.isArray(data?.scanConfig?.ignore) ? data.scanConfig?.ignore.filter((v) => typeof v === 'string') : []
    },
    lastScanAt: typeof data?.lastScanAt === 'string' ? data.lastScanAt : null,
    traySettings: {
      visible: typeof data?.traySettings?.visible === 'boolean' ? data.traySettings.visible : true,
      sections: {
        disk: typeof data?.traySettings?.sections?.disk === 'boolean' ? data.traySettings.sections.disk : true,
        memory:
          typeof data?.traySettings?.sections?.memory === 'boolean' ? data.traySettings.sections.memory : true,
        cpu: typeof data?.traySettings?.sections?.cpu === 'boolean' ? data.traySettings.sections.cpu : true,
        battery:
          typeof data?.traySettings?.sections?.battery === 'boolean' ? data.traySettings.sections.battery : true,
        latestScan:
          typeof data?.traySettings?.sections?.latestScan === 'boolean'
            ? data.traySettings.sections.latestScan
            : true,
        warning:
          typeof data?.traySettings?.sections?.warning === 'boolean'
            ? data.traySettings.sections.warning
            : true
      }
    }
  };
};

export class StorageService {
  private getFilePath() {
    return path.join(app.getPath('userData'), 'devcleaner-storage.json');
  }

  private async readStore(): Promise<StorageShape> {
    try {
      const raw = await readFile(this.getFilePath(), 'utf8');
      return normalizeStore(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          cleanupTotals: { ...DEFAULT_TOTALS },
          scanSchedule: { ...DEFAULT_SCHEDULE },
          scanConfig: { ...DEFAULT_SCAN_CONFIG },
          lastScanAt: null,
          traySettings: { ...DEFAULT_TRAY_SETTINGS }
        };
      }
      return {
        cleanupTotals: { ...DEFAULT_TOTALS },
        scanSchedule: { ...DEFAULT_SCHEDULE },
        scanConfig: { ...DEFAULT_SCAN_CONFIG },
        lastScanAt: null,
        traySettings: { ...DEFAULT_TRAY_SETTINGS }
      };
    }
  }

  private async writeStore(store: StorageShape) {
    const filePath = this.getFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
  }

  async getCleanupTotals(): Promise<CleanupTotals> {
    const store = await this.readStore();
    return store.cleanupTotals ?? { ...DEFAULT_TOTALS };
  }

  async setCleanupTotals(totals: CleanupTotals): Promise<void> {
    const store = await this.readStore();
    store.cleanupTotals = normalizeTotals(totals);
    await this.writeStore(store);
  }

  async resetCleanupTotals(): Promise<void> {
    const store = await this.readStore();
    store.cleanupTotals = { ...DEFAULT_TOTALS };
    await this.writeStore(store);
  }

  async getScanSchedule(): Promise<ScanSchedule> {
    const store = await this.readStore();
    return store.scanSchedule ?? { ...DEFAULT_SCHEDULE };
  }

  async setScanSchedule(schedule: ScanSchedule): Promise<void> {
    const store = await this.readStore();
    store.scanSchedule = {
      enabled: Boolean(schedule.enabled),
      intervalMinutes: schedule.intervalMinutes > 0 ? schedule.intervalMinutes : DEFAULT_SCHEDULE.intervalMinutes
    };
    await this.writeStore(store);
  }

  async getScanConfig(): Promise<ScanConfig> {
    const store = await this.readStore();
    return store.scanConfig ?? { ...DEFAULT_SCAN_CONFIG };
  }

  async setScanConfig(config: ScanConfig): Promise<void> {
    const store = await this.readStore();
    store.scanConfig = {
      roots: Array.isArray(config.roots) ? config.roots : [],
      targets: Array.isArray(config.targets) ? config.targets : [],
      ignore: Array.isArray(config.ignore) ? config.ignore : []
    };
    await this.writeStore(store);
  }

  async getLastScanAt(): Promise<string | null> {
    const store = await this.readStore();
    return store.lastScanAt ?? null;
  }

  async setLastScanAt(value: string | null): Promise<void> {
    const store = await this.readStore();
    store.lastScanAt = value;
    await this.writeStore(store);
  }

  async getTraySettings(): Promise<TraySettings> {
    const store = await this.readStore();
    return store.traySettings ?? { ...DEFAULT_TRAY_SETTINGS };
  }

  async setTraySettings(settings: TraySettings): Promise<void> {
    const store = await this.readStore();
    store.traySettings = {
      visible: Boolean(settings.visible),
      sections: {
        disk: Boolean(settings.sections.disk),
        memory: Boolean(settings.sections.memory),
        cpu: Boolean(settings.sections.cpu),
        battery: Boolean(settings.sections.battery),
        latestScan: Boolean(settings.sections.latestScan),
        warning: Boolean(settings.sections.warning)
      }
    };
    await this.writeStore(store);
  }
}

export const storageService = new StorageService();
