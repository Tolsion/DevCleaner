import { useMemo } from 'react';
import { Eye, EyeOff, Pause, Play, XCircle } from 'lucide-react';
import { useScanStore } from '../store/scanStore';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const ActivityOverlay = () => {
  const {
    isScanning,
    progress,
    scanStartedAt,
    isCleaning,
    cleanupProgress,
    cancelScan,
    cancelCleaning,
    overlayHidden,
    hideOverlay,
    showOverlay,
    scanPaused,
    cleaningPaused,
    pauseScan,
    resumeScan,
    pauseCleaning,
    resumeCleaning
  } = useScanStore();

  const scanMetrics = useMemo(() => {
    if (!scanStartedAt || !progress) return null;
    const elapsed = (Date.now() - scanStartedAt) / 1000;
    const percent = Math.max(progress.percent, 0);
    const remaining = percent > 0 ? (elapsed / percent) * (100 - percent) : 0;
    return { elapsed, remaining, percent };
  }, [scanStartedAt, progress]);

  const cleanupMetrics = useMemo(() => {
    if (!cleanupProgress) return null;
    const elapsed = (Date.now() - cleanupProgress.startedAt) / 1000;
    const percent = Math.max(cleanupProgress.percent, 0);
    const remaining = percent > 0 ? (elapsed / percent) * (100 - percent) : 0;
    return { elapsed, remaining, percent };
  }, [cleanupProgress]);

  if (!isScanning && !isCleaning) return null;

  if (overlayHidden) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={showOverlay}
          className="rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-slate-950/30"
        >
          <span className="flex items-center gap-2">
            <Eye size={14} />
            Show Progress
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl">
        {isScanning ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Scanning</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">
                {scanPaused ? 'Scan Paused' : 'Workspace scan in progress'}
              </h2>
              {scanPaused ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                  Paused
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted">{progress?.message ?? 'Scanning...'}</p>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-[width] ${
                  scanPaused ? 'bg-amber-400' : 'bg-accent'
                }`}
                style={{ width: `${scanMetrics?.percent ?? 0}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>Found: {progress?.foundCount ?? 0} folders</span>
              <span>Elapsed: {formatDuration(scanMetrics?.elapsed ?? 0)}</span>
              <span>Remaining: {formatDuration(scanMetrics?.remaining ?? 0)}</span>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={hideOverlay}
                className="mr-2 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900"
              >
                <span className="flex items-center gap-2">
                  <EyeOff size={14} />
                  Continue in Background
                </span>
              </button>
              <button
                type="button"
                onClick={() => void (scanPaused ? resumeScan() : pauseScan())}
                className="mr-2 rounded-lg border border-amber-400/60 bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30"
              >
                <span className="flex items-center gap-2">
                  {scanPaused ? <Play size={14} /> : <Pause size={14} />}
                  {scanPaused ? 'Resume Scan' : 'Pause Scan'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void cancelScan()}
                className="rounded-lg border border-rose-500/60 bg-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/35"
              >
                <span className="flex items-center gap-2">
                  <XCircle size={14} />
                  Cancel Scan
                </span>
              </button>
            </div>
          </>
        ) : null}

        {isCleaning && cleanupProgress ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Cleaning</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">
                {cleaningPaused ? 'Cleaning Paused' : 'Deleting junk folders'}
              </h2>
              {cleaningPaused ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                  Paused
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted">Cleaning in progress…</p>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-[width] ${
                  cleaningPaused ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${cleanupMetrics?.percent ?? 0}%` }}
              />
            </div>

            <div className="mt-4 grid gap-2 text-xs text-muted">
              <span>
                Cleaned {formatBytes(cleanupProgress.cleanedBytes)} / {formatBytes(cleanupProgress.totalBytes)}
              </span>
              <span>
                Targets {cleanupProgress.cleanedTargets} / {cleanupProgress.totalTargets}
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Elapsed: {formatDuration(cleanupMetrics?.elapsed ?? 0)}</span>
                <span>Remaining: {formatDuration(cleanupMetrics?.remaining ?? 0)}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={hideOverlay}
                className="mr-2 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900"
              >
                <span className="flex items-center gap-2">
                  <EyeOff size={14} />
                  Continue in Background
                </span>
              </button>
              <button
                type="button"
                onClick={cleaningPaused ? resumeCleaning : pauseCleaning}
                className="mr-2 rounded-lg border border-amber-400/60 bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30"
              >
                <span className="flex items-center gap-2">
                  {cleaningPaused ? <Play size={14} /> : <Pause size={14} />}
                  {cleaningPaused ? 'Resume Cleaning' : 'Pause Cleaning'}
                </span>
              </button>
              <button
                type="button"
                onClick={cancelCleaning}
                className="rounded-lg border border-rose-500/60 bg-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/35"
              >
                <span className="flex items-center gap-2">
                  <XCircle size={14} />
                  Cancel Cleaning
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ActivityOverlay;
