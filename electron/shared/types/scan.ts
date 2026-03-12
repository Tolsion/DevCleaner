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

export interface ScanResults {
  scannedAt: string | null;
  items: ScanResultItem[];
}

export type ScanPhase = 'scanning' | 'sizing' | 'finalizing' | 'done';

export interface ScanProgress {
  phase: ScanPhase;
  percent: number;
  foundCount: number;
  message: string;
  currentRoot?: string;
  currentPath?: string;
  lastFoundProject?: string;
}
