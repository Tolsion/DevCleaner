import { useMemo, useState } from "react";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useScanStore } from "../../store/scanStore";

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

const formatDate = (value: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatAge = (days: number) => {
  if (days <= 0) return "Today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
};

const MEDIA_TABS = [
  { id: "all", label: "All Media" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Documents" },
  { id: "archive", label: "Archives" },
] as const;

const QUICK_PRESETS = [
  { id: "downloads", label: "Downloads", roots: ["~/Downloads"] },
  { id: "desktop", label: "Desktop", roots: ["~/Desktop"] },
  { id: "pictures", label: "Pictures", roots: ["~/Pictures"] },
  { id: "media", label: "Media Folders", roots: ["~/Downloads", "~/Desktop", "~/Pictures", "~/Movies", "~/Music"] },
] as const;

const GeneralScanPage = () => {
  const { results, isScanning, startScan, targets, ignore, roots, setRoots } = useScanStore();
  const analysis = results.generalAnalysis;
  const [activeMediaTab, setActiveMediaTab] = useState<(typeof MEDIA_TABS)[number]["id"]>("all");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const totalAppBytes = useMemo(
    () => analysis.applications.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
    [analysis.applications]
  );

  const filteredLargeFiles = useMemo(() => {
    if (activeMediaTab === "all") return analysis.largeFiles;
    return analysis.largeFiles.filter((item) => item.category === activeMediaTab);
  }, [analysis.largeFiles, activeMediaTab]);

  const filteredOldestFiles = useMemo(() => {
    if (activeMediaTab === "all") return analysis.oldestFiles;
    return analysis.oldestFiles.filter((item) => item.category === activeMediaTab);
  }, [analysis.oldestFiles, activeMediaTab]);

  const filteredStaleFiles = useMemo(() => {
    if (activeMediaTab === "all") return analysis.staleFiles;
    return analysis.staleFiles.filter((item) => item.category === activeMediaTab);
  }, [analysis.staleFiles, activeMediaTab]);

  const filteredMediaSummary = useMemo(() => {
    if (activeMediaTab === "all") return analysis.mediaSummary;
    return analysis.mediaSummary.filter((item) => item.category === activeMediaTab);
  }, [analysis.mediaSummary, activeMediaTab]);

  const handleRunPreset = async (presetRoots: string[], presetId: string) => {
    setActivePreset(presetId);
    setRoots(presetRoots);
    await startScan({ roots: presetRoots, targets, ignore });
  };

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isScanning && results.items.length === 0 ? <LoadingOverlay label="Profiling files and applications" /> : null}

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Quick Presets</p>
            <h3 className="mt-2 text-lg font-semibold">Run targeted scans fast</h3>
            <p className="mt-1 text-xs text-muted">
              Current roots: {roots.length ? roots.join(", ") : "Not set"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void handleRunPreset(preset.roots as string[], preset.id)}
                disabled={isScanning}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  activePreset === preset.id
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Scanned Files</p>
          <p className="mt-3 text-3xl font-semibold">{analysis.scannedFileCount.toLocaleString()}</p>
          <p className="mt-2 text-sm text-muted">{analysis.scannedDirectoryCount.toLocaleString()} directories</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Total Data</p>
          <p className="mt-3 text-3xl font-semibold">{formatBytes(analysis.totalScannedBytes)}</p>
          <p className="mt-2 text-sm text-muted">Across selected roots</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Media</p>
          <p className="mt-3 text-3xl font-semibold">{formatBytes(analysis.totalMediaBytes)}</p>
          <p className="mt-2 text-sm text-muted">Images, videos, audio</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Applications</p>
          <p className="mt-3 text-3xl font-semibold">{analysis.applications.length}</p>
          <p className="mt-2 text-sm text-muted">{formatBytes(totalAppBytes)} sized</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Media Breakdown</p>
            <h3 className="mt-2 text-lg font-semibold">Filter by content type</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {MEDIA_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMediaTab(tab.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeMediaTab === tab.id
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {filteredMediaSummary.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Run a scan to see media and archive distribution.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredMediaSummary.map((item) => (
              <div key={item.category} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted">{item.category}</p>
                <p className="mt-2 text-2xl font-semibold">{formatBytes(item.totalBytes)}</p>
                <p className="mt-1 text-xs text-muted">{item.count.toLocaleString()} files</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Largest Files</h3>
            <span className="text-xs text-muted">{formatBytes(analysis.largeFileThresholdBytes)}+</span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredLargeFiles.length === 0 ? (
              <p className="text-sm text-muted">No matching large files found for this tab.</p>
            ) : (
              filteredLargeFiles.map((item) => (
                <div key={item.path} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                  <p className="mt-1 break-all text-xs text-muted">{item.path}</p>
                  <p className="mt-2 text-xs text-slate-300">
                    {item.sizeLabel} · {item.category} · Modified {formatDate(item.modifiedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Oldest Files</h3>
            <span className="text-xs text-muted">By age</span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredOldestFiles.length === 0 ? (
              <p className="text-sm text-muted">No matching old files found for this tab.</p>
            ) : (
              filteredOldestFiles.map((item) => (
                <div key={item.path} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                  <p className="mt-1 break-all text-xs text-muted">{item.path}</p>
                  <p className="mt-2 text-xs text-slate-300">
                    {formatAge(item.ageDays)} old · Last touched {formatDate(item.accessedAt ?? item.modifiedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Least Used</h3>
            <span className="text-xs text-muted">{analysis.staleThresholdDays}+ days untouched</span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredStaleFiles.length === 0 ? (
              <p className="text-sm text-muted">No matching stale files found for this tab.</p>
            ) : (
              filteredStaleFiles.map((item) => (
                <div key={item.path} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                  <p className="mt-1 break-all text-xs text-muted">{item.path}</p>
                  <p className="mt-2 text-xs text-slate-300">
                    {formatAge(item.ageDays)} idle · {item.sizeLabel}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Installed Applications</p>
            <h3 className="mt-2 text-lg font-semibold">Largest detected apps</h3>
          </div>
          <span className="text-xs text-muted">Top {analysis.applications.length}</span>
        </div>
        {analysis.applications.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Application inventory was not available on this platform.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">App</th>
                  <th className="px-4 py-3">Publisher</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analysis.applications.map((app) => (
                  <tr key={`${app.name}-${app.path}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{app.name}</p>
                      <p className="mt-1 text-xs text-muted">{app.path || "Unknown path"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{app.publisher ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-slate-300">{app.version ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-slate-100">{app.sizeBytes !== null ? formatBytes(app.sizeBytes) : "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          "Least used" is inferred from last access date when available, otherwise last modified date.
        </p>
      </section>
    </div>
  );
};

export default GeneralScanPage;
