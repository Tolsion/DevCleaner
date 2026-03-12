import { FolderOpen, Play } from "lucide-react";

interface DashboardHeaderProps {
  isScanning: boolean;
  lastScanAt: string | null;
  onScan: () => Promise<void>;
  onPickRoots: () => Promise<void>;
  roots: string[];
}

const DashboardHeader = ({
  isScanning,
  lastScanAt,
  onScan,
  onPickRoots,
  roots,
}: DashboardHeaderProps) => {
  return (
    <header className="fixed left-64 right-0 top-0 z-20 border-b border-slate-800 bg-canvas/90 backdrop-blur">
      <div className="flex items-center justify-between px-8 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Dev Cleaner Desktop
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Workspace Health Dashboard
          </h1>
          <p className="mt-1 text-xs text-muted">
            {lastScanAt ? `Last run: ${lastScanAt}` : "No scans yet"} · Roots:{" "}
            {roots.length ? roots.length : "Not set"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPickRoots}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FolderOpen size={16} />
            Pick Folders
          </button>
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Play size={16} />
            {isScanning ? "Scanning…" : "Start Scan"}
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
