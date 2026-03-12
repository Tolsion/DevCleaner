import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Layers, Trash2 } from "lucide-react";
import { useScanStore } from "../../store/scanStore";
import LoadingOverlay from "../../components/LoadingOverlay";
import ScanResultsTable from "./ScanResultsTable";
import type { ScanResultItem } from "../../../electron/shared/types/scan";

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

const ScanResultsPage = () => {
  const {
    results,
    lastCleanupBytes,
    lastCleanupAt,
    deleteItems,
    deleteJunk,
    roots,
    history,
    isScanning,
  } = useScanStore();
  const [showCleanup, setShowCleanup] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"name" | "size">("size");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmState, setConfirmState] = useState<{
    items: ScanResultItem[];
    label: string;
  } | null>(null);

  const summary = useMemo(() => {
    const projectCount = results.items.length;
    const junkFolderCount = results.items.reduce(
      (sum, item) => sum + item.junkFolders.length,
      0,
    );
    const totalBytes = results.items.reduce(
      (sum, item) => sum + item.junkSizeBytes,
      0,
    );
    return {
      projectCount,
      junkFolderCount,
      totalBytes,
    };
  }, [results.items]);

  const topProjects = useMemo(() => {
    return [...results.items]
      .sort((a, b) => b.junkSizeBytes - a.junkSizeBytes)
      .slice(0, 5);
  }, [results.items]);

  const sortedItems = useMemo(() => {
    const items = [...results.items];
    items.sort((a, b) => {
      if (sortKey === "name") {
        const value = a.projectName.localeCompare(b.projectName);
        return sortDir === "asc" ? value : -value;
      }
      const value = a.junkSizeBytes - b.junkSizeBytes;
      return sortDir === "asc" ? value : -value;
    });
    return items;
  }, [results.items, sortKey, sortDir]);

  const groupedItems = useMemo(() => {
    const groups: Array<{
      root: string;
      items: ScanResultItem[];
      totalBytes: number;
    }> = [];
    for (const root of roots) {
      const rootLabel = root;
      const rootBase = root.split("/").filter(Boolean).pop() ?? root;
      const matched = sortedItems.filter((item) => {
        if (item.rootPath.startsWith(root)) return true;
        if (root.includes("~/") && rootBase) {
          return (
            item.rootPath.includes(`/${rootBase}/`) ||
            item.rootPath.endsWith(`/${rootBase}`)
          );
        }
        return false;
      });
      if (matched.length > 0) {
        const totalBytes = matched.reduce(
          (sum, item) => sum + item.junkSizeBytes,
          0,
        );
        groups.push({ root: rootLabel, items: matched, totalBytes });
      }
    }

    const groupedIds = new Set(
      groups.flatMap((group) => group.items.map((item) => item.id)),
    );
    const ungrouped = sortedItems.filter((item) => !groupedIds.has(item.id));
    if (ungrouped.length > 0) {
      const totalBytes = ungrouped.reduce(
        (sum, item) => sum + item.junkSizeBytes,
        0,
      );
      groups.push({ root: "Other", items: ungrouped, totalBytes });
    }

    return groups;
  }, [roots, sortedItems]);

  const selectedItems = useMemo(
    () => sortedItems.filter((item) => selectedIds.has(item.id)),
    [sortedItems, selectedIds],
  );

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === sortedItems.length) {
        return new Set();
      }
      return new Set(sortedItems.map((item) => item.id));
    });
  };

  const handleSort = (key: "name" | "size") => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const handleCleanSelected = async () => {
    if (selectedItems.length === 0) return;
    setConfirmState({ items: selectedItems, label: "Clean selected items" });
  };

  const handleCleanAll = async () => {
    if (sortedItems.length === 0) return;
    setConfirmState({ items: sortedItems, label: "Clean all items" });
  };

  const handleCleanOne = async (item: ScanResultItem) => {
    setConfirmState({
      items: [item],
      label: `Clean project: ${item.projectName}`,
    });
  };

  const handleConfirmCleanup = async () => {
    if (!confirmState) return;
    await deleteItems(confirmState.items);
    setSelectedIds(new Set());
    setConfirmState(null);
  };

  useEffect(() => {
    if (!lastCleanupAt || lastCleanupBytes <= 0) return;
    setShowCleanup(true);
    const timer = window.setTimeout(() => setShowCleanup(false), 4500);
    return () => window.clearTimeout(timer);
  }, [lastCleanupAt, lastCleanupBytes]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const item of sortedItems) {
        if (prev.has(item.id)) next.add(item.id);
      }
      return next;
    });
  }, [sortedItems]);

  return (
    <section className="grid gap-6">
      {isScanning && results.items.length === 0 ? (
        <LoadingOverlay label="Loading scan data" />
      ) : null}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Scan Results
          </p>
        </div>
      </header>

      {showCleanup ? (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-200 shadow-lg shadow-emerald-500/20 animate-pulse">
            Cleaned {formatBytes(lastCleanupBytes)} of space.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-200">
            <span>Projects</span>
            <FolderKanban size={14} />
          </div>
          <p className="mt-3 text-3xl font-semibold text-emerald-100">
            {summary.projectCount}
          </p>
          <p className="mt-2 text-sm text-emerald-200/70">
            Roots with junk folders detected.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-sky-200">
            <span>Junk Folders</span>
            <Layers size={14} />
          </div>
          <p className="mt-3 text-3xl font-semibold text-sky-100">
            {summary.junkFolderCount}
          </p>
          <p className="mt-2 text-sm text-sky-200/70">
            node_modules, dist, build, cache.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-amber-200">
            <span>Total Junk Size</span>
            <Trash2 size={14} />
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-100">
            {formatBytes(summary.totalBytes)}
          </p>
          <p className="mt-2 text-sm text-amber-200/70">
            Potential cleanup savings.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Projects by Junk</h3>
            <span className="text-xs text-muted">
              {formatBytes(summary.totalBytes)} total
            </span>
          </div>
          {topProjects.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Run a scan to see the heaviest projects.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {topProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{project.projectName}</span>
                    <span className="text-xs text-muted">
                      {project.junkSizeLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${summary.totalBytes ? (project.junkSizeBytes / summary.totalBytes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Scan History</h3>
            <span className="text-xs text-muted">{history.length} entries</span>
          </div>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No scans yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {history.map((entry, index) => (
                <div
                  key={`${entry.scannedAt ?? "none"}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-muted"
                >
                  <p className="text-slate-200">
                    {formatTimestamp(entry.scannedAt)}
                  </p>
                  <p className="mt-1">
                    {entry.totalProjects} projects · {entry.totalFolders}{" "}
                    folders
                  </p>
                  <p className="mt-1">{formatBytes(entry.totalBytes)} junk</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-4 rounded-2xl bg-surface/70">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Latest Scan</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>{formatTimestamp(results.scannedAt)}</span>
            <button
              type="button"
              onClick={handleCleanSelected}
              disabled={selectedItems.length === 0}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clean Selected
            </button>
            <button
              type="button"
              onClick={handleCleanAll}
              disabled={sortedItems.length === 0}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clean All
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {groupedItems.length === 0 ? (
            <ScanResultsTable
              items={sortedItems}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onCleanOne={handleCleanOne}
              onSort={handleSort}
              sortKey={sortKey}
              sortDir={sortDir}
            />
          ) : (
            groupedItems.map((group, index) => (
              <details
                key={`${group.root}-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/40"
                open
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-semibold">{group.root}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      Total junk: {formatBytes(group.totalBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setConfirmState({
                          items: group.items,
                          label: `Clean group: ${group.root}`,
                        });
                      }}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
                    >
                      Clean Group
                    </button>
                  </div>
                </summary>
                <div className="border-t border-slate-800">
                  <ScanResultsTable
                    items={group.items}
                    selectedIds={selectedIds}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    onCleanOne={handleCleanOne}
                    onSort={handleSort}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    showHeader={index === 0}
                  />
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Confirm Cleanup
            </p>
            <h3 className="mt-2 text-xl font-semibold">{confirmState.label}</h3>
            <p className="mt-2 text-sm text-muted">
              This will delete {confirmState.items.length} item(s) and their
              junk folders.
            </p>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-200">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                Folders to delete
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto font-mono text-xs text-slate-200">
                {confirmState.items.map((item) => (
                  <li key={item.id}>
                    {item.rootPath}
                    {item.junkFolders.length > 0
                      ? ` → ${item.junkFolders.join(", ")}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCleanup}
                className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Confirm Clean
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ScanResultsPage;
