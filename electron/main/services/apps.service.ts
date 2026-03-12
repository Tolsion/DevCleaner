import os from 'node:os';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { app, nativeImage } from 'electron';

import type { AppsListResponse } from '../../shared/types/apps';

const exec = promisify(execCallback);

const parseMdlsValue = (output: string, key: string) => {
  const line = output
    .split('\n')
    .find((entry) => entry.trim().startsWith(`${key} =`));
  if (!line) return null;
  const match = line.match(/=\s*(.+)$/);
  if (!match) return null;
  return match[1].replace(/^"|"$/g, '').trim() || null;
};

const getAppMetadata = async (appPath: string) => {
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
      const { stderr } = await exec(
        `codesign -dv --verbose=2 "${appPath.replace(/"/g, '\\"')}" 2>&1`
      );
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

  try {
    const thumb = await nativeImage.createThumbnailFromPath(appPath, { width: 64, height: 64 });
    const resized = thumb.isEmpty() ? null : thumb.resize({ width: 48, height: 48 });
    iconDataUrl = resized ? resized.toDataURL() : null;
  } catch {
    iconDataUrl = null;
  }

  if (!iconDataUrl) {
    try {
      const icon = await app.getFileIcon(appPath, { size: 'large' });
      const resized = icon.isEmpty() ? null : icon.resize({ width: 48, height: 48 });
      iconDataUrl = resized ? resized.toDataURL() : null;
    } catch {
      iconDataUrl = null;
    }
  }

  if (!iconDataUrl) {
    try {
      const { stdout } = await exec(`mdls -name kMDItemIconFile "${appPath.replace(/"/g, '\\"')}"`);
      const iconFile = parseMdlsValue(stdout, 'kMDItemIconFile');
      if (iconFile) {
        const iconName = iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`;
        const iconPath = path.join(appPath, 'Contents', 'Resources', iconName);
        const icon = nativeImage.createFromPath(iconPath);
        const resized = icon.isEmpty() ? null : icon.resize({ width: 48, height: 48 });
        iconDataUrl = resized ? resized.toDataURL() : null;
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
        const iconPath = path.join(appPath, 'Contents', 'Resources', iconName);
        const icon = nativeImage.createFromPath(iconPath);
        const resized = icon.isEmpty() ? null : icon.resize({ width: 48, height: 48 });
        iconDataUrl = resized ? resized.toDataURL() : null;
      }
    } catch {
      // ignore
    }
  }

  return { sizeBytes, bundleId, version, publisher, iconDataUrl };
};

const listAppBundles = async (root: string) => {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const apps = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.endsWith('.app')) continue;
      const appPath = path.join(root, entry.name);
      let installedAt: string | null = null;
      try {
        const info = await stat(appPath);
        installedAt = info.birthtime ? info.birthtime.toISOString() : null;
      } catch {
        installedAt = null;
      }
      const metadata = await getAppMetadata(appPath);
      apps.push({
        name: entry.name.replace(/\.app$/i, ''),
        path: appPath,
        installedAt,
        sizeBytes: metadata.sizeBytes,
        bundleId: metadata.bundleId,
        version: metadata.version,
        publisher: metadata.publisher,
        iconDataUrl: metadata.iconDataUrl
      });
    }
    return apps;
  } catch {
    return [];
  }
};

export const listInstalledApps = async (): Promise<AppsListResponse> => {
  if (process.platform !== 'darwin') {
    return { supported: false, apps: [] };
  }

  const appPaths = ['/Applications', path.join(os.homedir(), 'Applications')];
  const results = await Promise.all(appPaths.map((root) => listAppBundles(root)));
  const apps = results.flat();
  const seen = new Set<string>();
  const unique = apps.filter((app) => {
    if (seen.has(app.path)) return false;
    seen.add(app.path);
    return true;
  });
  unique.sort((a, b) => a.name.localeCompare(b.name));
  return { supported: true, apps: unique };
};
