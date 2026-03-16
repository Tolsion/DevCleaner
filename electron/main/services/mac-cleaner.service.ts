import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { exec as execCallback } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { shell } from 'electron';
import type {
  LargeFileResult,
  LargeFileScanResult,
  MacJunkCategory,
  MacJunkCategoryId,
  MacJunkCleanResult,
  MacJunkSummary,
  MemoryProcess,
  MemoryProcessResult,
  StartupItem,
  StartupItemsResult
} from '../../shared/types/mac-cleaner';

type JunkDefinition = {
  id: MacJunkCategoryId;
  label: string;
  path: string;
};

const getJunkDefinitions = (): JunkDefinition[] => {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const windowsDir = process.env.WINDIR || 'C:\\Windows';
    return [
      { id: 'caches', label: 'Browser Cache', path: path.join(localAppData, 'Microsoft', 'Windows', 'INetCache') },
      { id: 'temp', label: 'User Temp Files', path: path.join(localAppData, 'Temp') },
      { id: 'crashReports', label: 'Crash Dumps', path: path.join(localAppData, 'CrashDumps') },
      { id: 'windowsTemp', label: 'Windows Temp', path: path.join(windowsDir, 'Temp') },
      { id: 'prefetch', label: 'Prefetch', path: path.join(windowsDir, 'Prefetch') }
    ];
  }

  return [
    { id: 'caches', label: 'User Caches', path: '~/Library/Caches' },
    { id: 'logs', label: 'User Logs', path: '~/Library/Logs' },
    { id: 'crashReports', label: 'Crash Reports', path: '~/Library/Application Support/CrashReporter' },
    { id: 'xcodeDerivedData', label: 'Xcode Derived Data', path: '~/Library/Developer/Xcode/DerivedData' }
  ];
};

const SKIP_DIRS = new Set(['.git', 'node_modules', '.DS_Store', '.idea']);
type TrashRecord = {
  originalPath: string;
  trashedAt: number;
};
let lastTrashBatch: TrashRecord[] = [];

const resolveHomePath = (target: string) => {
  if (target.startsWith('~/')) {
    return path.join(os.homedir(), target.slice(2));
  }
  return target;
};

const isSafeJunkPath = (targetPath: string) => {
  const resolved = path.resolve(targetPath);
  return getJunkDefinitions().some((definition) => path.resolve(resolveHomePath(definition.path)) === resolved);
};

const dirSizeAndCount = async (root: string): Promise<{ sizeBytes: number; fileCount: number }> => {
  let sizeBytes = 0;
  let fileCount = 0;
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        try {
          const info = await stat(fullPath);
          sizeBytes += info.size;
          fileCount += 1;
        } catch {
          continue;
        }
      }
    }
  }

  return { sizeBytes, fileCount };
};

const getJunkSummary = async (): Promise<MacJunkSummary> => {
  const categories: MacJunkCategory[] = [];
  let totalBytes = 0;

  for (const definition of getJunkDefinitions()) {
    const resolvedPath = resolveHomePath(definition.path);
    let exists = false;
    let sizeBytes = 0;
    let fileCount = 0;

    try {
      const stats = await stat(resolvedPath);
      exists = stats.isDirectory();
    } catch {
      exists = false;
    }

    if (exists) {
      const totals = await dirSizeAndCount(resolvedPath);
      sizeBytes = totals.sizeBytes;
      fileCount = totals.fileCount;
      totalBytes += sizeBytes;
    }

    categories.push({
      id: definition.id,
      label: definition.label,
      path: resolvedPath,
      sizeBytes,
      fileCount,
      exists
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    categories,
    totalBytes
  };
};

const cleanJunk = async (ids: MacJunkCategoryId[], useTrash = true): Promise<MacJunkCleanResult[]> => {
  const results: MacJunkCleanResult[] = [];
  const summary = await getJunkSummary();
  const byId = new Map(summary.categories.map((category) => [category.id, category] as const));
  const trashed: TrashRecord[] = [];

  for (const id of ids) {
    const category = byId.get(id);
    if (!category) {
      results.push({ id, path: '', deleted: false, freedBytes: 0, error: 'Unknown category' });
      continue;
    }

    if (!category.exists) {
      results.push({ id, path: category.path, deleted: true, freedBytes: 0 });
      continue;
    }

    if (!isSafeJunkPath(category.path)) {
      results.push({ id, path: category.path, deleted: false, freedBytes: 0, error: 'Unsafe path' });
      continue;
    }

    try {
      if (useTrash) {
        await shell.trashItem(category.path);
        trashed.push({ originalPath: category.path, trashedAt: Date.now() });
      } else {
        await rm(category.path, { recursive: true, force: true });
      }
      results.push({ id, path: category.path, deleted: true, freedBytes: category.sizeBytes });
    } catch (error) {
      results.push({
        id,
        path: category.path,
        deleted: false,
        freedBytes: 0,
        error: error instanceof Error ? error.message : 'Failed to delete'
      });
    }
  }

  if (trashed.length > 0) {
    lastTrashBatch = trashed;
  }

  return results;
};

const isWithinRoots = (targetPath: string, roots: string[]) => {
  const resolvedTarget = path.resolve(resolveHomePath(targetPath));
  return roots.some((root) => {
    const resolvedRoot = path.resolve(resolveHomePath(root));
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
  });
};

const deleteLargeFiles = async (
  paths: string[],
  roots: string[],
  useTrash = true
): Promise<{ path: string; deleted: boolean; error?: string }[]> => {
  const results: { path: string; deleted: boolean; error?: string }[] = [];
  const trashed: TrashRecord[] = [];

  for (const filePath of paths) {
    const resolvedPath = resolveHomePath(filePath);
    if (!isWithinRoots(resolvedPath, roots)) {
      results.push({ path: filePath, deleted: false, error: 'Path is outside allowed roots' });
      continue;
    }
    try {
      const info = await stat(resolvedPath);
      if (!info.isFile()) {
        results.push({ path: filePath, deleted: false, error: 'Not a file' });
        continue;
      }
      if (useTrash) {
        await shell.trashItem(resolvedPath);
        trashed.push({ originalPath: resolvedPath, trashedAt: Date.now() });
      } else {
        await rm(resolvedPath, { force: true });
      }
      results.push({ path: filePath, deleted: true });
    } catch (error) {
      results.push({
        path: filePath,
        deleted: false,
        error: error instanceof Error ? error.message : 'Failed to delete'
      });
    }
  }

  if (trashed.length > 0) {
    lastTrashBatch = trashed;
  }

  return results;
};

const undoTrash = async (): Promise<{ originalPath: string; restored: boolean; error?: string }[]> => {
  if (lastTrashBatch.length === 0) return [];
  const results: { originalPath: string; restored: boolean; error?: string }[] = [];
  const trashRoot = path.join(os.homedir(), '.Trash');

  for (const record of lastTrashBatch) {
    const baseName = path.basename(record.originalPath);
    const trashedPath = path.join(trashRoot, baseName);
    try {
      const info = await stat(trashedPath);
      if (!info) {
        results.push({ originalPath: record.originalPath, restored: false, error: 'Not found in Trash' });
        continue;
      }
      await mkdir(path.dirname(record.originalPath), { recursive: true });
      await rename(trashedPath, record.originalPath);
      results.push({ originalPath: record.originalPath, restored: true });
    } catch (error) {
      results.push({
        originalPath: record.originalPath,
        restored: false,
        error: error instanceof Error ? error.message : 'Failed to restore'
      });
    }
  }

  lastTrashBatch = [];
  return results;
};

const scanLargeFiles = async (
  roots: string[],
  minBytes: number,
  maxResults = 200
): Promise<LargeFileScanResult> => {
  const files: LargeFileResult[] = [];

  const maybeTrim = () => {
    if (files.length <= maxResults) return;
    files.sort((a, b) => b.sizeBytes - a.sizeBytes);
    files.splice(maxResults);
  };

  for (const root of roots) {
    const resolvedRoot = resolveHomePath(root);
    const stack = [resolvedRoot];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          stack.push(path.join(current, entry.name));
        } else if (entry.isFile()) {
          const fullPath = path.join(current, entry.name);
          try {
            const info = await stat(fullPath);
            if (info.size >= minBytes) {
              files.push({
                path: fullPath,
                sizeBytes: info.size,
                modifiedAt: info.mtime.toISOString()
              });
              maybeTrim();
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  files.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    scannedAt: new Date().toISOString(),
    roots,
    minBytes,
    files
  };
};

const listStartupItems = async (): Promise<StartupItemsResult> => {
  const items: StartupItem[] = [];
  if (process.platform === 'win32') {
    const startupDirs: Array<{ scope: StartupItem['scope']; root: string }> = [
      {
        scope: 'user',
        root: path.join(
          process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Startup'
        )
      },
      {
        scope: 'system',
        root: path.join(
          process.env.ProgramData || 'C:\\ProgramData',
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Startup'
        )
      }
    ];

    for (const { scope, root } of startupDirs) {
      let entries;
      try {
        entries = await readdir(root, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        items.push({
          name: entry.name.replace(/\.(lnk|url|cmd|bat|exe)$/i, ''),
          path: path.join(root, entry.name),
          scope
        });
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      items
    };
  }

  const scopes: Array<{ scope: StartupItem['scope']; root: string }> = [
    { scope: 'user', root: path.join(os.homedir(), 'Library/LaunchAgents') },
    { scope: 'system', root: '/Library/LaunchAgents' }
  ];

  for (const { scope, root } of scopes) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.plist')) continue;
      items.push({
        name: entry.name.replace(/\.plist$/i, ''),
        path: path.join(root, entry.name),
        scope
      });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    items
  };
};

const parsePsOutput = (output: string): MemoryProcess[] => {
  const lines = output.split('\n').slice(1).filter(Boolean);
  const processes: MemoryProcess[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const pid = Number(parts[0] ?? 0);
    const user = parts[1] ?? 'unknown';
    const cpu = Number(parts[parts.length - 3] ?? 0);
    const mem = Number(parts[parts.length - 2] ?? 0);
    const rssKb = Number(parts[parts.length - 1] ?? 0);
    const command = parts.slice(2, parts.length - 3).join(' ');
    if (!Number.isFinite(pid)) continue;
    processes.push({ pid, user, command, cpu, mem, rssKb });
  }

  return processes;
};

const listMemoryProcesses = async (): Promise<MemoryProcessResult> => {
  const exec = promisify(execCallback);
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "Get-Process | Sort-Object WS -Descending | Select-Object -First 25 Id,ProcessName,CPU,WS,SI | ConvertTo-Json -Compress"'
      );
      const raw = stdout.trim();
      if (!raw) {
        return { sampledAt: new Date().toISOString(), processes: [] };
      }
      const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const totalMemKb = Math.max(1, Math.round(os.totalmem() / 1024));
      return {
        sampledAt: new Date().toISOString(),
        processes: entries.map((entry) => {
          const rssKb =
            typeof entry.WS === 'number' && Number.isFinite(entry.WS)
              ? Math.round(entry.WS / 1024)
              : 0;
          return {
            pid: typeof entry.Id === 'number' ? entry.Id : 0,
            user: 'current',
            command: typeof entry.ProcessName === 'string' ? entry.ProcessName : 'unknown',
            cpu: typeof entry.CPU === 'number' && Number.isFinite(entry.CPU) ? entry.CPU : 0,
            mem: (rssKb / totalMemKb) * 100,
            rssKb
          };
        })
      };
    } catch {
      return { sampledAt: new Date().toISOString(), processes: [] };
    }
  }

  try {
    const { stdout } = await exec('ps -ax -o pid,user,command,pcpu,pmem,rss');
    const processes = parsePsOutput(stdout)
      .sort((a, b) => b.mem - a.mem)
      .slice(0, 25);
    return { sampledAt: new Date().toISOString(), processes };
  } catch {
    return { sampledAt: new Date().toISOString(), processes: [] };
  }
};

const terminateProcess = async (pid: number): Promise<{ terminated: boolean; error?: string }> => {
  if (pid <= 1) {
    return { terminated: false, error: 'Refusing to terminate system process.' };
  }

  if (process.platform === 'darwin') {
    const exec = promisify(execCallback);
    try {
      const { stdout } = await exec(`ps -o user= -p ${pid}`);
      const owner = stdout.trim();
      const current = os.userInfo().username;
      if (!owner || owner !== current) {
        return { terminated: false, error: 'Can only terminate processes owned by the current user.' };
      }
    } catch (error) {
      return { terminated: false, error: error instanceof Error ? error.message : 'Failed to inspect process' };
    }
  }

  try {
    process.kill(pid, 'SIGTERM');
    return { terminated: true };
  } catch (error) {
    return { terminated: false, error: error instanceof Error ? error.message : 'Failed to terminate process' };
  }
};

export const macCleanerService = {
  getJunkSummary,
  cleanJunk,
  scanLargeFiles,
  deleteLargeFiles,
  undoTrash,
  listStartupItems,
  listMemoryProcesses,
  terminateProcess
};
