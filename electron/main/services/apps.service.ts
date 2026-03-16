import os from 'node:os';
import path from 'node:path';
import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { app, nativeImage } from 'electron';

import type { AppInfo, AppsListResponse } from '../../shared/types/apps';

const exec = promisify(execCallback);

const fileExists = async (targetPath: string) => {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const parseMdlsValue = (output: string, key: string) => {
  const line = output
    .split('\n')
    .find((entry) => entry.trim().startsWith(`${key} =`));
  if (!line) return null;
  const match = line.match(/=\s*(.+)$/);
  if (!match) return null;
  return match[1].replace(/^"|"$/g, '').trim() || null;
};

const toDataUrl = (icon: Electron.NativeImage) => {
  if (icon.isEmpty()) return null;
  return icon.resize({ width: 48, height: 48 }).toDataURL();
};

const getIconDataUrl = async (targetPath: string) => {
  try {
    const thumb = await nativeImage.createThumbnailFromPath(targetPath, { width: 64, height: 64 });
    const thumbData = toDataUrl(thumb);
    if (thumbData) return thumbData;
  } catch {
    // ignore
  }

  try {
    const icon = await app.getFileIcon(targetPath, { size: 'large' });
    return toDataUrl(icon);
  } catch {
    return null;
  }
};

const parseWindowsDate = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{8}$/.test(text)) return null;
  const formatted = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const date = new Date(`${formatted}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const cleanWindowsPath = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const withoutQuotes = text.replace(/^"+|"+$/g, '');
  const [candidate] = withoutQuotes.split(',');
  const expanded = candidate.replace(/%([^%]+)%/g, (_match, key: string) => process.env[key] ?? '');
  return expanded.trim() || null;
};

const getMacAppMetadata = async (appPath: string) => {
  let sizeBytes: number | null = null;
  let bundleId: string | null = null;
  let version: string | null = null;
  let publisher: string | null = null;
  let iconDataUrl: string | null = null;

  try {
    const { stdout } = await exec(`du -sk "${appPath.replace(/"/g, '\\"')}"`);
    const sizeKb = Number(stdout.trim().split(/\s+/)[0] ?? 0);
    sizeBytes = Number.isFinite(sizeKb) ? sizeKb * 1024 : null;
  } catch {
    sizeBytes = null;
  }

  try {
    const { stdout } = await exec(
      `mdls -name kMDItemCFBundleIdentifier -name kMDItemVersion -name kMDItemOrganizationName "${appPath.replace(
        /"/g,
        '\\"'
      )}"`
    );
    bundleId = parseMdlsValue(stdout, 'kMDItemCFBundleIdentifier');
    version = parseMdlsValue(stdout, 'kMDItemVersion');
    publisher = parseMdlsValue(stdout, 'kMDItemOrganizationName');
  } catch {
    bundleId = null;
    version = null;
    publisher = null;
  }

  if (!publisher) {
    try {
      const { stderr } = await exec(`codesign -dv --verbose=2 "${appPath.replace(/"/g, '\\"')}" 2>&1`);
      const authority = stderr
        .split('\n')
        .find((line) => line.trim().startsWith('Authority='));
      if (authority) {
        publisher = authority.replace('Authority=', '').trim();
      }
    } catch {
      // ignore
    }
  }

  iconDataUrl = await getIconDataUrl(appPath);

  if (!iconDataUrl) {
    try {
      const { stdout } = await exec(`mdls -name kMDItemIconFile "${appPath.replace(/"/g, '\\"')}"`);
      const iconFile = parseMdlsValue(stdout, 'kMDItemIconFile');
      if (iconFile) {
        const iconName = iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`;
        iconDataUrl = await getIconDataUrl(path.join(appPath, 'Contents', 'Resources', iconName));
      }
    } catch {
      // ignore
    }
  }

  if (!iconDataUrl) {
    try {
      const plistPath = path.join(appPath, 'Contents', 'Info.plist');
      const { stdout } = await exec(
        `/usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "${plistPath.replace(/"/g, '\\"')}"`
      );
      const iconFile = stdout.trim();
      if (iconFile) {
        const iconName = iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`;
        iconDataUrl = await getIconDataUrl(path.join(appPath, 'Contents', 'Resources', iconName));
      }
    } catch {
      // ignore
    }
  }

  return { sizeBytes, bundleId, version, publisher, iconDataUrl };
};

const listMacAppBundles = async (root: string): Promise<AppInfo[]> => {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const apps: AppInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue;
      const appPath = path.join(root, entry.name);
      let installedAt: string | null = null;
      try {
        const info = await stat(appPath);
        installedAt = info.birthtime ? info.birthtime.toISOString() : null;
      } catch {
        installedAt = null;
      }
      const metadata = await getMacAppMetadata(appPath);
      apps.push({
        name: entry.name.replace(/\.app$/i, ''),
        path: appPath,
        installedAt,
        sizeBytes: metadata.sizeBytes,
        bundleId: metadata.bundleId,
        version: metadata.version,
        publisher: metadata.publisher,
        iconDataUrl: metadata.iconDataUrl,
        uninstallSupported: true,
        uninstallHint: null
      });
    }
    return apps;
  } catch {
    return [];
  }
};

const listWindowsApps = async (): Promise<AppInfo[]> => {
  const command =
    'powershell -NoProfile -Command "Get-ItemProperty ' +
    "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' " +
    '| Where-Object { $_.DisplayName } ' +
    '| Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation, DisplayIcon, EstimatedSize ' +
    '| ConvertTo-Json -Compress"';

  try {
    const { stdout } = await exec(command);
    const raw = stdout.trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const apps: AppInfo[] = [];

    for (const entry of entries) {
      const name = typeof entry.DisplayName === 'string' ? entry.DisplayName.trim() : '';
      if (!name) continue;

      const installLocation = cleanWindowsPath(entry.InstallLocation);
      const displayIcon = cleanWindowsPath(entry.DisplayIcon);
      const resolvedPath = displayIcon || installLocation || '';
      const stats = resolvedPath && (await fileExists(resolvedPath)) ? await stat(resolvedPath).catch(() => null) : null;
      const iconDataUrl =
        resolvedPath && (await fileExists(resolvedPath))
          ? await getIconDataUrl(resolvedPath)
          : null;

      apps.push({
        name,
        path: resolvedPath,
        installedAt: parseWindowsDate(entry.InstallDate),
        sizeBytes:
          typeof entry.EstimatedSize === 'number' && Number.isFinite(entry.EstimatedSize)
            ? entry.EstimatedSize * 1024
            : stats?.isFile() || stats?.isDirectory()
              ? stats.size
              : null,
        bundleId: null,
        version: typeof entry.DisplayVersion === 'string' ? entry.DisplayVersion : null,
        publisher: typeof entry.Publisher === 'string' ? entry.Publisher : null,
        iconDataUrl,
        uninstallSupported: false,
        uninstallHint: 'Windows registry installs cannot be safely removed by moving files to the Recycle Bin.'
      });
    }

    return apps;
  } catch {
    return [];
  }
};

export const listInstalledApps = async (): Promise<AppsListResponse> => {
  if (process.platform === 'darwin') {
    const appPaths = ['/Applications', path.join(os.homedir(), 'Applications')];
    const results = await Promise.all(appPaths.map((root) => listMacAppBundles(root)));
    const apps = results.flat();
    const seen = new Set<string>();
    const unique = apps.filter((entry) => {
      const key = `${entry.name}:${entry.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => a.name.localeCompare(b.name));
    return { supported: true, apps: unique };
  }

  if (process.platform === 'win32') {
    const apps = await listWindowsApps();
    const seen = new Set<string>();
    const unique = apps.filter((entry) => {
      const key = `${entry.name}:${entry.publisher ?? ''}:${entry.version ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => a.name.localeCompare(b.name));
    return { supported: true, apps: unique };
  }

  return { supported: false, apps: [] };
};
