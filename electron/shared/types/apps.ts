export type AppInfo = {
  name: string;
  path: string;
  installedAt: string | null;
  sizeBytes: number | null;
  bundleId: string | null;
  version: string | null;
  publisher: string | null;
  iconDataUrl: string | null;
  uninstallSupported: boolean;
  uninstallHint: string | null;
};

export type AppsListResponse = {
  supported: boolean;
  apps: AppInfo[];
};
