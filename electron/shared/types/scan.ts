export interface ScanStartPayload {
  roots: string[];
  targets?: string[];
  ignore?: string[];
}

export interface ScanResultItem {
  id: string;
  projectName: string;
  rootPath: string;
  junkFolders: string[];
  junkSizeBytes: number;
  junkSizeLabel: string;
}

export interface GeneralScanEntry {
  path: string;
  name: string;
  sizeBytes: number;
  sizeLabel: string;
  extension: string | null;
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'binary' | 'other';
  modifiedAt: string;
  accessedAt: string | null;
  ageDays: number;
}

export interface GeneralMediaSummary {
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'binary' | 'other';
  count: number;
  totalBytes: number;
}

export interface GeneralAppScanEntry {
  name: string;
  path: string;
  sizeBytes: number | null;
  version: string | null;
  publisher: string | null;
}

export interface GeneralScanAnalysis {
  scannedFileCount: number;
  scannedDirectoryCount: number;
  totalScannedBytes: number;
  totalMediaBytes: number;
  staleThresholdDays: number;
  largeFileThresholdBytes: number;
  largeFiles: GeneralScanEntry[];
  oldestFiles: GeneralScanEntry[];
  staleFiles: GeneralScanEntry[];
  mediaSummary: GeneralMediaSummary[];
  applications: GeneralAppScanEntry[];
}

export interface ScanResults {
  scannedAt: string | null;
  items: ScanResultItem[];
  generalAnalysis: GeneralScanAnalysis;
}

export type ScanPhase = 'scanning' | 'sizing' | 'profiling' | 'finalizing' | 'done';

export interface ScanProgress {
  phase: ScanPhase;
  percent: number;
  foundCount: number;
  message: string;
  currentRoot?: string;
  currentPath?: string;
  lastFoundProject?: string;
}
