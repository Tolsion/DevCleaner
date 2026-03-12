import { useMemo, useState } from "react";
import { useScanStore } from "../../store/scanStore";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useToastStore } from "../../store/toastStore";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatTimestamp = (value: string | null) => {
  if (!value) return "No scans yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const CleanupPreviewPage = () => {
  const {
    results,
    totalCleanedBytes,
    totalCleanedFolders,
    totalCleanedProjects,
    resetTotals,
    isScanning,
  } = useScanStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const pushToast = useToastStore((state) => state.push);

  const totals = useMemo(() => {
    const totalBytes = results.items.reduce(
      (sum, item) => sum + item.junkSizeBytes,
      0,
    );
    const totalFolders = results.items.reduce(
      (sum, item) => sum + item.junkFolders.length,
      0,
    );
    return { totalBytes, totalFolders };
  }, [results.items]);

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isScanning && results.items.length === 0 ? (
        <LoadingOverlay label="Loading scan data" />
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Potential Savings
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {formatBytes(totals.totalBytes)}
          </p>
          <p className="mt-2 text-sm text-muted">Based on latest scan data.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Junk Folders
          </p>
          <p className="mt-3 text-3xl font-semibold">{totals.totalFolders}</p>
          <p className="mt-2 text-sm text-muted">
            node_modules, dist, build, cache.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Projects
          </p>
          <p className="mt-3 text-3xl font-semibold">{results.items.length}</p>
          <p className="mt-2 text-sm text-muted">Ready to clean.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Total Cleanup
          </p>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-900/60"
          >
            Reset Totals
          </button>
        </div>
        <p className="mt-2 text-lg font-semibold">
          You have cleaned {formatBytes(totalCleanedBytes)} from your device so
          far.
        </p>
        <p className="mt-2 text-sm text-muted">
          {totalCleanedProjects} project · {totalCleanedFolders} folders
        </p>
      </section>

      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Reset Totals
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              Cleanup totals will be cleared
            </h3>
            <p className="mt-2 text-sm text-muted">
              This removes the cumulative cleanup stats stored on this device.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetTotals();
                  pushToast({
                    message: "Cleanup totals reset.",
                    tone: "success",
                  });
                  setConfirmReset(false);
                }}
                className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cleanup Items</h2>
          <span className="text-xs text-muted">
            {formatTimestamp(results.scannedAt)}
          </span>
        </div>
        {results.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Run a scan to see cleanup candidates.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {results.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.projectName}</p>
                    <p className="text-xs text-muted">{item.rootPath}</p>
                  </div>
                  <span className="text-xs text-slate-200">
                    {item.junkSizeLabel}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.junkFolders.map((folder) => (
                    <span
                      key={folder}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                    >
                      {folder}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CleanupPreviewPage;
