export type MacJunkCategoryId =
  | 'caches'
  | 'logs'
  | 'crashReports'
  | 'xcodeDerivedData'
  | 'temp'
  | 'windowsTemp'
  | 'prefetch';

export interface MacJunkCategory {
  id: MacJunkCategoryId;
  label: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
  exists: boolean;
}

export interface MacJunkSummary {
  scannedAt: string;
  categories: MacJunkCategory[];
  totalBytes: number;
}

export interface MacJunkCleanResult {
  id: MacJunkCategoryId;
  path: string;
  deleted: boolean;
  freedBytes: number;
  error?: string;
}

export interface LargeFileResult {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface LargeFileScanResult {
  scannedAt: string;
  roots: string[];
  minBytes: number;
  files: LargeFileResult[];
}

export interface LargeFileDeleteResult {
  path: string;
  deleted: boolean;
  error?: string;
}

export interface UndoTrashResult {
  originalPath: string;
  restored: boolean;
  error?: string;
}

export interface StartupItem {
  name: string;
  path: string;
  scope: 'user' | 'system';
}

export interface StartupItemsResult {
  scannedAt: string;
  items: StartupItem[];
}

export interface MemoryProcess {
  pid: number;
  user: string;
  command: string;
  cpu: number;
  mem: number;
  rssKb: number;
}

export interface MemoryProcessResult {
  sampledAt: string;
  processes: MemoryProcess[];
}
