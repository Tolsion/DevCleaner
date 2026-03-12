import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ScanProgress, ScanResults, ScanStartPayload } from '../../shared/types/scan';

const SKIP_DIRS = new Set(['.git', '.hg', '.svn', '.idea']);
const DEFAULT_TARGETS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage'
]);

const resolveRoot = (input: string) => {
  if (input.startsWith('~/')) {
    return path.join(homedir(), input.slice(2));
  }
  return input;
};

const isDirectory = async (target: string) => {
  try {
    const info = await stat(target);
    return info.isDirectory();
  } catch {
    return false;
  }
};

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatEta = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'calculating...';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const waitIfPaused = async (shouldPause?: () => boolean) => {
  if (!shouldPause?.()) return;
  while (shouldPause?.()) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

const dirSize = async (
  root: string,
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean
): Promise<number> => {
  let total = 0;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (shouldAbort?.()) {
      throw new Error('Scan cancelled');
    }
    await waitIfPaused(shouldPause);
    const fullPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      total += await dirSize(fullPath, shouldAbort, shouldPause);
    } else if (entry.isFile()) {
      try {
        const info = await stat(fullPath);
        total += info.size;
      } catch {
        continue;
      }
    }
  }

  return total;
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) => {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
};

const countDirectories = async (
  root: string,
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean,
  targetDirs?: Set<string>,
  ignoreDirs?: Set<string>
) => {
  let count = 0;
  const stack = [root];

  while (stack.length > 0) {
    if (shouldAbort?.()) {
      throw new Error('Scan cancelled');
    }
    await waitIfPaused(shouldPause);
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.isSymbolicLink()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (ignoreDirs && ignoreDirs.has(entry.name)) continue;
      if ((targetDirs ?? DEFAULT_TARGETS).has(entry.name)) continue;

      count += 1;
      stack.push(path.join(current, entry.name));
    }
  }

  return count;
};

const findJunkFolders = async (
  root: string,
  onVisit?: (visitedCount: number) => void,
  onMatch?: (matchPath: string, totalMatches: number) => void,
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean,
  targetDirs?: Set<string>,
  ignoreDirs?: Set<string>
) => {
  const results: string[] = [];
  const stack = [root];
  let visited = 0;
  const targetList = Array.from(targetDirs ?? DEFAULT_TARGETS);
  const nameTargets = new Set(targetList.filter((target) => !target.includes('/')));
  const pathTargets = targetList
    .filter((target) => target.includes('/'))
    .map((target) => target.replace(/\\/g, '/'));

  while (stack.length > 0) {
    if (shouldAbort?.()) {
      throw new Error('Scan cancelled');
    }
    await waitIfPaused(shouldPause);
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.isSymbolicLink()) continue;

      if ((ignoreDirs && ignoreDirs.has(entry.name)) || SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const matchPath = path.join(current, entry.name);
      if (nameTargets.has(entry.name)) {
        results.push(matchPath);
        onMatch?.(matchPath, results.length);
        continue;
      }
      if (pathTargets.length > 0) {
        const normalizedPath = matchPath.split(path.sep).join('/');
        const isMatch = pathTargets.some(
          (target) =>
            normalizedPath.endsWith(`/${target}`) || normalizedPath.endsWith(target)
        );
        if (isMatch) {
          results.push(matchPath);
          onMatch?.(matchPath, results.length);
          continue;
        }
      }

      stack.push(matchPath);
      visited += 1;
      onVisit?.(visited);
    }
  }

  return results;
};

class ScannerService {
  async scan(
    payload: ScanStartPayload,
    onProgress?: (progress: ScanProgress) => void,
    shouldAbort?: () => boolean,
    shouldPause?: () => boolean
  ): Promise<ScanResults> {
    const now = new Date().toISOString();
    const roots = payload.roots.map(resolveRoot);
    const targetDirs = payload.targets ? new Set(payload.targets) : DEFAULT_TARGETS;
    const ignoreDirs = payload.ignore ? new Set(payload.ignore) : new Set<string>();
    const matches: { junkPath: string; junkName: string; projectRoot: string; projectName: string }[] = [];
    let foundCount = 0;
    const scanStart = Date.now();

    onProgress?.({
      phase: 'scanning',
      percent: 0,
      foundCount: 0,
      message: 'Scanning workspace roots...'
    });

    let totalDirs = 0;
    for (const root of roots) {
      if (!(await isDirectory(root))) continue;
      totalDirs += await countDirectories(root, shouldAbort, shouldPause, targetDirs, ignoreDirs);
    }

    totalDirs = Math.max(totalDirs, 1);
    let visitedDirs = 0;

    for (const [index, root] of roots.entries()) {
      if (!(await isDirectory(root))) continue;
      let rootVisited = 0;
      const rootMatches = await findJunkFolders(
        root,
        (visitedCount) => {
          const delta = visitedCount - rootVisited;
          rootVisited = visitedCount;
          visitedDirs += delta;
          const percent = Math.min(70, Math.round((visitedDirs / totalDirs) * 70));
          const elapsedSeconds = (Date.now() - scanStart) / 1000;
          const etaSeconds = visitedDirs > 0 ? (elapsedSeconds / visitedDirs) * (totalDirs - visitedDirs) : 0;
          onProgress?.({
            phase: 'scanning',
            percent,
            foundCount,
            message: `Scanning folders... ETA ${formatEta(etaSeconds)}`
          });
        },
        (matchPath, totalMatches) => {
          const projectRoot = path.dirname(matchPath);
          const projectName = path.basename(projectRoot) || 'Unknown';
          foundCount = totalMatches;
          const percent = Math.min(70, Math.round((visitedDirs / totalDirs) * 70));
          onProgress?.({
            phase: 'scanning',
            percent,
            foundCount,
            message: 'Finding junk folders...',
            currentRoot: root,
            currentPath: matchPath,
            lastFoundProject: projectName
          });
        },
        shouldAbort,
        shouldPause,
        targetDirs,
        ignoreDirs
      );

      for (const junkPath of rootMatches) {
        const junkName = path.basename(junkPath);
        const projectRoot = path.dirname(junkPath);
        const projectName = path.basename(projectRoot) || 'Unknown';
        matches.push({ junkPath, junkName, projectRoot, projectName });
      }

      foundCount = matches.length;
      const percent = Math.min(70, Math.round(((index + 1) / roots.length) * 70));
        onProgress?.({
          phase: 'scanning',
          percent,
          foundCount,
          message: `Scanned ${index + 1}/${roots.length} roots`,
          currentRoot: root
        });
    }

    onProgress?.({
      phase: 'sizing',
      percent: Math.min(75, matches.length === 0 ? 70 : 75),
      foundCount,
      message: 'Measuring folder sizes...'
    });

    const itemsMap = new Map<
      string,
      {
        id: string;
        projectName: string;
        rootPath: string;
        junkFolders: string[];
        junkSizeBytes: number;
      }
    >();

    const sizingStart = Date.now();
    let sizedCount = 0;
    const concurrency = Math.min(4, Math.max(1, matches.length));

    await runWithConcurrency(matches, concurrency, async (match, index) => {
      const sizeBytes = await dirSize(match.junkPath, shouldAbort, shouldPause);

      const existing = itemsMap.get(match.projectRoot);
      if (existing) {
        if (!existing.junkFolders.includes(match.junkName)) {
          existing.junkFolders.push(match.junkName);
        }
        existing.junkSizeBytes += sizeBytes;
      } else {
        itemsMap.set(match.projectRoot, {
          id: `junk-${itemsMap.size}`,
          projectName: match.projectName,
          rootPath: match.projectRoot,
          junkFolders: [match.junkName],
          junkSizeBytes: sizeBytes
        });
      }

      sizedCount += 1;
      const percent = 70 + Math.round((sizedCount / Math.max(matches.length, 1)) * 25);
      const elapsedSeconds = (Date.now() - sizingStart) / 1000;
      const etaSeconds = sizedCount > 0 ? (elapsedSeconds / sizedCount) * (matches.length - sizedCount) : 0;
      onProgress?.({
        phase: 'sizing',
        percent,
        foundCount,
        message: `Sizing ${sizedCount}/${matches.length} folders · ETA ${formatEta(etaSeconds)}`
      });

      return { index };
    });

    const items = Array.from(itemsMap.values()).map((item) => ({
      ...item,
      junkSizeLabel: formatBytes(item.junkSizeBytes)
    }));

    onProgress?.({
      phase: 'finalizing',
      percent: 98,
      foundCount,
      message: 'Compiling results...'
    });

    return {
      scannedAt: now,
      items
    };
  }
}

export const scannerService = new ScannerService();
