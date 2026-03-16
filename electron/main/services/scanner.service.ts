import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type {
  GeneralAppScanEntry,
  GeneralMediaSummary,
  GeneralScanAnalysis,
  GeneralScanEntry,
  ScanProgress,
  ScanResults,
  ScanStartPayload
} from '../../shared/types/scan';
import { listInstalledApps } from './apps.service';

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
const MEDIA_EXTENSIONS = {
  image: new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.svg', '.bmp', '.tiff', '.avif']),
  video: new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.wmv']),
  audio: new Set(['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a']),
  document: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.rtf']),
  archive: new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2']),
  binary: new Set(['.dmg', '.pkg', '.exe', '.msi', '.iso', '.apk'])
} as const;
const LARGE_FILE_THRESHOLD_BYTES = 250 * 1024 * 1024;
const STALE_THRESHOLD_DAYS = 180;
const GENERAL_RESULT_LIMIT = 25;

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
    if (entry.isSymbolicLink()) continue;
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
    if (shouldAbort?.()) throw new Error('Scan cancelled');
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
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (ignoreDirs?.has(entry.name)) continue;
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
    if (shouldAbort?.()) throw new Error('Scan cancelled');
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
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (ignoreDirs?.has(entry.name) || SKIP_DIRS.has(entry.name)) continue;

      const matchPath = path.join(current, entry.name);
      if (nameTargets.has(entry.name)) {
        results.push(matchPath);
        onMatch?.(matchPath, results.length);
        continue;
      }
      if (pathTargets.length > 0) {
        const normalizedPath = matchPath.split(path.sep).join('/');
        const isMatch = pathTargets.some(
          (target) => normalizedPath.endsWith(`/${target}`) || normalizedPath.endsWith(target)
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

const getFileCategory = (
  extension: string
): GeneralScanEntry['category'] => {
  if (MEDIA_EXTENSIONS.image.has(extension)) return 'image';
  if (MEDIA_EXTENSIONS.video.has(extension)) return 'video';
  if (MEDIA_EXTENSIONS.audio.has(extension)) return 'audio';
  if (MEDIA_EXTENSIONS.document.has(extension)) return 'document';
  if (MEDIA_EXTENSIONS.archive.has(extension)) return 'archive';
  if (MEDIA_EXTENSIONS.binary.has(extension)) return 'binary';
  return 'other';
};

const trimEntries = (
  list: GeneralScanEntry[],
  entry: GeneralScanEntry,
  limit: number,
  compare: (a: GeneralScanEntry, b: GeneralScanEntry) => number
) => {
  list.push(entry);
  list.sort(compare);
  if (list.length > limit) {
    list.splice(limit);
  }
};

const buildGeneralEntry = (targetPath: string, sizeBytes: number, modifiedAt: Date, accessedAt: Date) => {
  const extension = path.extname(targetPath).toLowerCase() || null;
  const category = getFileCategory(extension ?? '');
  const ageBase = accessedAt.getTime() > 0 ? accessedAt : modifiedAt;
  const ageDays = Math.max(0, Math.floor((Date.now() - ageBase.getTime()) / 86400000));
  return {
    path: targetPath,
    name: path.basename(targetPath),
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    extension,
    category,
    modifiedAt: modifiedAt.toISOString(),
    accessedAt: Number.isFinite(accessedAt.getTime()) ? accessedAt.toISOString() : null,
    ageDays
  } satisfies GeneralScanEntry;
};

const getEmptyGeneralAnalysis = (): GeneralScanAnalysis => ({
  scannedFileCount: 0,
  scannedDirectoryCount: 0,
  totalScannedBytes: 0,
  totalMediaBytes: 0,
  staleThresholdDays: STALE_THRESHOLD_DAYS,
  largeFileThresholdBytes: LARGE_FILE_THRESHOLD_BYTES,
  largeFiles: [],
  oldestFiles: [],
  staleFiles: [],
  mediaSummary: [],
  applications: []
});

const profileGeneralFiles = async (
  roots: string[],
  ignoreDirs: Set<string>,
  onProgress?: (progress: ScanProgress) => void,
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean
): Promise<GeneralScanAnalysis> => {
  const analysis = getEmptyGeneralAnalysis();
  const mediaMap = new Map<GeneralMediaSummary['category'], { count: number; totalBytes: number }>();

  for (const root of roots) {
    if (!(await isDirectory(root))) continue;
    const stack = [root];
    while (stack.length > 0) {
      if (shouldAbort?.()) throw new Error('Scan cancelled');
      await waitIfPaused(shouldPause);
      const current = stack.pop();
      if (!current) continue;
      analysis.scannedDirectoryCount += 1;
      onProgress?.({
        phase: 'profiling',
        percent: 90,
        foundCount: analysis.scannedFileCount,
        message: `Profiling files under ${path.basename(current) || current}...`,
        currentRoot: root,
        currentPath: current
      });

      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (shouldAbort?.()) throw new Error('Scan cancelled');
        await waitIfPaused(shouldPause);
        const fullPath = path.join(current, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name) || ignoreDirs.has(entry.name)) continue;
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;

        let info;
        try {
          info = await stat(fullPath);
        } catch {
          continue;
        }

        analysis.scannedFileCount += 1;
        analysis.totalScannedBytes += info.size;
        const built = buildGeneralEntry(fullPath, info.size, info.mtime, info.atime);

        const mediaBucket = mediaMap.get(built.category) ?? { count: 0, totalBytes: 0 };
        mediaBucket.count += 1;
        mediaBucket.totalBytes += built.sizeBytes;
        mediaMap.set(built.category, mediaBucket);
        if (built.category === 'image' || built.category === 'video' || built.category === 'audio') {
          analysis.totalMediaBytes += built.sizeBytes;
        }

        if (built.sizeBytes >= LARGE_FILE_THRESHOLD_BYTES) {
          trimEntries(analysis.largeFiles, built, GENERAL_RESULT_LIMIT, (a, b) => b.sizeBytes - a.sizeBytes);
        }
        trimEntries(analysis.oldestFiles, built, GENERAL_RESULT_LIMIT, (a, b) => b.ageDays - a.ageDays);
        if (built.ageDays >= STALE_THRESHOLD_DAYS) {
          trimEntries(analysis.staleFiles, built, GENERAL_RESULT_LIMIT, (a, b) => b.ageDays - a.ageDays);
        }
      }
    }
  }

  analysis.mediaSummary = Array.from(mediaMap.entries())
    .map(([category, values]) => ({
      category,
      count: values.count,
      totalBytes: values.totalBytes
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  try {
    const apps = await listInstalledApps();
    analysis.applications = apps.apps
      .filter((entry) => entry.sizeBytes !== null || entry.version || entry.publisher)
      .sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
      .slice(0, GENERAL_RESULT_LIMIT)
      .map<GeneralAppScanEntry>((entry) => ({
        name: entry.name,
        path: entry.path,
        sizeBytes: entry.sizeBytes,
        version: entry.version,
        publisher: entry.publisher
      }));
  } catch {
    analysis.applications = [];
  }

  return analysis;
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
        (localVisited) => {
          rootVisited = localVisited;
          visitedDirs += 1;
          const percent = Math.min(75, Math.round((visitedDirs / totalDirs) * 75));
          const elapsedSeconds = (Date.now() - scanStart) / 1000;
          const rate = visitedDirs / Math.max(elapsedSeconds, 1);
          const remaining = Math.max(totalDirs - visitedDirs, 0);
          onProgress?.({
            phase: 'scanning',
            percent,
            foundCount,
            message: `Scanning ${path.basename(root)} (${formatEta(remaining / Math.max(rate, 1))} left)`,
            currentRoot: root,
            currentPath: root,
            lastFoundProject: matches[matches.length - 1]?.projectName
          });
        },
        (matchPath, totalMatches) => {
          foundCount = totalMatches;
          const projectRoot = path.dirname(matchPath);
          matches.push({
            junkPath: matchPath,
            junkName: path.basename(matchPath),
            projectRoot,
            projectName: path.basename(projectRoot)
          });
          onProgress?.({
            phase: 'scanning',
            percent: Math.min(80, Math.round((visitedDirs / totalDirs) * 80)),
            foundCount,
            message: `Found ${path.basename(matchPath)} in ${path.basename(projectRoot)}`,
            currentRoot: root,
            currentPath: matchPath,
            lastFoundProject: path.basename(projectRoot)
          });
        },
        shouldAbort,
        shouldPause,
        targetDirs,
        ignoreDirs
      );

      if (rootMatches.length === 0 && index === roots.length - 1 && foundCount === 0) {
        onProgress?.({
          phase: 'scanning',
          percent: 82,
          foundCount: 0,
          message: `No junk folders found in ${path.basename(root)}`
        });
      }

      visitedDirs += Math.max(0, rootVisited);
    }

    onProgress?.({
      phase: 'sizing',
      percent: 84,
      foundCount,
      message: `Calculating size for ${matches.length} junk folders...`
    });

    const uniqueProjects = new Map<string, { projectName: string; rootPath: string; junkFolders: string[] }>();
    for (const match of matches) {
      const existing = uniqueProjects.get(match.projectRoot);
      if (existing) {
        existing.junkFolders.push(match.junkName);
      } else {
        uniqueProjects.set(match.projectRoot, {
          projectName: match.projectName,
          rootPath: match.projectRoot,
          junkFolders: [match.junkName]
        });
      }
    }

    const items = await runWithConcurrency(
      Array.from(uniqueProjects.values()),
      4,
      async (project, index) => {
        if (shouldAbort?.()) throw new Error('Scan cancelled');
        await waitIfPaused(shouldPause);
        const junkPaths = project.junkFolders.map((folder) => path.join(project.rootPath, folder));
        const sizes = await Promise.all(junkPaths.map((target) => dirSize(target, shouldAbort, shouldPause)));
        const junkSizeBytes = sizes.reduce((sum, value) => sum + value, 0);
        const percent = 84 + Math.round(((index + 1) / Math.max(uniqueProjects.size, 1)) * 8);
        onProgress?.({
          phase: 'sizing',
          percent: Math.min(percent, 92),
          foundCount,
          message: `Sized ${project.projectName} (${formatBytes(junkSizeBytes)})`,
          currentPath: project.rootPath,
          lastFoundProject: project.projectName
        });
        return {
          id: project.rootPath,
          projectName: project.projectName,
          rootPath: project.rootPath,
          junkFolders: project.junkFolders,
          junkSizeBytes,
          junkSizeLabel: formatBytes(junkSizeBytes)
        };
      }
    );

    onProgress?.({
      phase: 'profiling',
      percent: 93,
      foundCount,
      message: 'Profiling large, old, and media files...'
    });

    const generalAnalysis = await profileGeneralFiles(roots, ignoreDirs, onProgress, shouldAbort, shouldPause);

    const sortedItems = items.sort((a, b) => b.junkSizeBytes - a.junkSizeBytes);

    onProgress?.({
      phase: 'finalizing',
      percent: 98,
      foundCount,
      message: 'Preparing scan report...'
    });

    const results: ScanResults = {
      scannedAt: now,
      items: sortedItems,
      generalAnalysis
    };

    onProgress?.({
      phase: 'done',
      percent: 100,
      foundCount,
      message: `Scan complete. ${sortedItems.length} projects and ${generalAnalysis.largeFiles.length} large files highlighted.`
    });

    return results;
  }
}

export const scannerService = new ScannerService();
