import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, RefreshCw, Trash2, Zap } from 'lucide-react';
import { useMacCleanerStore } from '../../store/macCleanerStore';
import LoadingOverlay from '../../components/LoadingOverlay';
import type { MacJunkCategory } from '../../../electron/shared/types/mac-cleaner';
import { detectRendererOsFamily, getPlatformDisplayName, getTrashLabel } from '../../app/platform';

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

const formatProcessLabel = (command: string) => {
  if (!command) return 'Unknown';
  const trimmed = command.trim();
  if (!trimmed) return 'Unknown';
  const firstToken = trimmed.split(/\s+/)[0] ?? trimmed;
  const candidate = firstToken.startsWith('/') ? firstToken : trimmed;
  const appMatch = candidate.match(/\/([^/]+)\.app\//);
  if (appMatch?.[1]) return appMatch[1];
  if (firstToken.startsWith('/')) {
    const parts = firstToken.split('/');
    return parts[parts.length - 1] || firstToken;
  }
  return trimmed;
};

const humanizeIdentifier = (value: string) => {
  const cleaned = value
    .replace(/steamclean/gi, 'steam clean')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return value;
  return cleaned
    .split(' ')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'macos') return 'macOS';
      if (lower === 'xpc') return 'XPC';
      if (lower === 'ios') return 'iOS';
      if (lower === 'osx') return 'OS X';
      if (part.length <= 1) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(' ');
};

const formatLaunchAgentName = (name: string) => {
  const parts = name.split('.').filter(Boolean);
  const genericTail = new Set(['agent', 'helper', 'service', 'xpcservice', 'wake', 'daemon', 'launcher']);
  const tail = parts[parts.length - 1] ?? name;
  const prev = parts[parts.length - 2];
  if (genericTail.has(tail.toLowerCase()) && prev) {
    return `${humanizeIdentifier(prev)} ${humanizeIdentifier(tail === 'xpcservice' ? 'XPC Service' : tail)}`;
  }
  return humanizeIdentifier(tail);
};

const MacCleanerPage = () => {
  const {
    junkSummary,
    junkCleanResults,
    largeFiles,
    largeFileDeletes,
    lastTrashCount,
    undoResults,
    startupItems,
    memoryProcesses,
    isLoading,
    error,
    scanJunk,
    cleanJunk,
    scanLargeFiles,
    deleteLargeFiles,
    undoTrash,
    listStartupItems,
    listMemoryProcesses,
    terminateProcess
  } = useMacCleanerStore();

  const platform = detectRendererOsFamily();
  const platformName = getPlatformDisplayName(platform);
  const trashLabel = getTrashLabel(platform);
  const [selectedJunk, setSelectedJunk] = useState<Record<string, boolean>>({});
  const [largeFileRoots, setLargeFileRoots] = useState<string[]>(["~/"]);
  const [minSizeMb, setMinSizeMb] = useState(500);
  const [selectedLargeFiles, setSelectedLargeFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void scanJunk();
    void listStartupItems();
    void listMemoryProcesses();
  }, [scanJunk, listStartupItems, listMemoryProcesses]);

  useEffect(() => {
    if (!junkSummary) return;
    const next: Record<string, boolean> = {};
    for (const category of junkSummary.categories) {
      next[category.id] = category.exists && category.sizeBytes > 0;
    }
    setSelectedJunk(next);
  }, [junkSummary]);

  const totalSelectedBytes = useMemo(() => {
    if (!junkSummary) return 0;
    return junkSummary.categories
      .filter((category) => selectedJunk[category.id])
      .reduce((sum, category) => sum + category.sizeBytes, 0);
  }, [junkSummary, selectedJunk]);

  const handlePickRoots = async () => {
    const response = await window.devCleaner.folders.pick();
    if (response.ok && response.data.length > 0) {
      setLargeFileRoots(response.data);
    }
  };

  const handleClean = async () => {
    const ids = Object.keys(selectedJunk).filter((id) => selectedJunk[id]);
    if (!ids.length) return;
    await cleanJunk(ids);
    await scanJunk();
  };

  const handleDeleteLargeFiles = async () => {
    if (!largeFiles?.files.length) return;
    const paths = largeFiles.files.filter((file) => selectedLargeFiles[file.path]).map((file) => file.path);
    if (!paths.length) return;
    await deleteLargeFiles({ paths, roots: largeFileRoots, useTrash: true });
    await scanLargeFiles({ roots: largeFileRoots, minBytes: minSizeMb * 1024 * 1024, maxResults: 200 });
    setSelectedLargeFiles({});
  };

  const renderJunkRow = (category: MacJunkCategory) => {
    const disabled = !category.exists || category.sizeBytes === 0;
    return (
      <label
        key={category.id}
        className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm transition ${
          disabled ? 'border-slate-800/60 text-muted' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={Boolean(selectedJunk[category.id])}
            disabled={disabled}
            onChange={(event) =>
              setSelectedJunk((prev) => ({ ...prev, [category.id]: event.target.checked }))
            }
            className="h-4 w-4 accent-emerald-400"
          />
          <div>
            <p className="text-sm font-medium text-slate-100">{category.label}</p>
            <p className="text-xs text-muted">{category.path}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-100">{formatBytes(category.sizeBytes)}</p>
          <p className="text-xs text-muted">{category.fileCount} files</p>
        </div>
      </label>
    );
  };

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isLoading ? <LoadingOverlay label="Loading cleaner data" /> : null}
      {error ? (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </section>
      ) : null}

      {lastTrashCount > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-slate-100">
              {lastTrashCount} item(s) moved to {trashLabel}.
            </p>
            <button
              type="button"
              onClick={() => void undoTrash()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              Undo last {trashLabel}
            </button>
          </div>
        </section>
      ) : null}

      {undoResults.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-muted">
          Undo results: {undoResults.filter((item) => item.restored).length} of {undoResults.length} restored.
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">System Junk</p>
            <h3 className="mt-2 text-lg font-semibold">
              {platform === 'windows' ? 'Clean temp files and crash data' : 'Clean user-level cache and logs'}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {platform === 'windows'
                ? `Targets safe cleanup locations on ${platformName}.`
                : 'Targets only folders under ~/Library (no system-wide deletion).'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void scanJunk()}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              <RefreshCw size={14} />
              Rescan
            </button>
            <button
              type="button"
              onClick={() => void handleClean()}
              disabled={isLoading || totalSelectedBytes === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Trash2 size={14} />
              Clean {formatBytes(totalSelectedBytes)}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {junkSummary?.categories.map(renderJunkRow) ?? (
            <p className="text-sm text-muted">Scanning junk folders…</p>
          )}
        </div>
        {junkCleanResults.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-muted">
            Last clean results: {junkCleanResults.filter((item) => item.deleted).length} of{' '}
            {junkCleanResults.length} items moved to {trashLabel}.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Large Files</p>
            <h3 className="mt-2 text-lg font-semibold">Find oversized files to delete manually</h3>
            <p className="mt-1 text-xs text-muted">Scan only selected folders to keep results tight.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePickRoots}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              <FolderOpen size={14} />
              Pick Folders
            </button>
            <button
              type="button"
              onClick={() =>
                void scanLargeFiles({ roots: largeFileRoots, minBytes: minSizeMb * 1024 * 1024, maxResults: 200 })
              }
              className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-110"
            >
              <RefreshCw size={14} />
              Scan
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Minimum size</span>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={minSizeMb}
              onChange={(event) => setMinSizeMb(Number(event.target.value))}
            />
            <span className="text-slate-100">{minSizeMb} MB</span>
          </div>
          <div className="text-xs text-muted">Roots: {largeFileRoots.join(', ')}</div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <p>Selected: {Object.values(selectedLargeFiles).filter(Boolean).length} file(s)</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!largeFiles?.files.length) return;
                const next: Record<string, boolean> = {};
                for (const file of largeFiles.files) {
                  next[file.path] = true;
                }
                setSelectedLargeFiles(next);
              }}
              className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedLargeFiles({})}
              className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteLargeFiles()}
              disabled={isLoading || Object.values(selectedLargeFiles).every((value) => !value)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Trash2 size={14} />
              Move to {trashLabel}
            </button>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Select</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {largeFiles?.files.length ? (
                largeFiles.files.map((file) => (
                  <tr key={file.path}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedLargeFiles[file.path])}
                        onChange={(event) =>
                          setSelectedLargeFiles((prev) => ({ ...prev, [file.path]: event.target.checked }))
                        }
                        className="h-4 w-4 accent-emerald-400"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-200">{file.path}</td>
                    <td className="px-3 py-2">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-3 py-2 text-muted">{new Date(file.modifiedAt).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3 text-xs text-muted" colSpan={4}>
                    {largeFiles ? 'No large files found for this filter.' : 'Run a scan to see results.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {largeFileDeletes.length > 0 ? (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-muted">
            Last delete results: {largeFileDeletes.filter((item) => item.deleted).length} of{' '}
            {largeFileDeletes.length} moved to {trashLabel}.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Startup Items</p>
            <h3 className="mt-2 text-lg font-semibold">
              {platform === 'windows' ? 'Startup entries (read-only)' : 'Launch agents (read-only)'}
            </h3>
            <p className="mt-1 text-xs text-muted">User and system scopes listed, removal not enabled.</p>
          </div>
          <button
            type="button"
            onClick={() => void listStartupItems()}
            className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-2 text-xs">
          {startupItems?.items.length ? (
            startupItems.items.map((item) => (
              <div key={item.path} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {formatLaunchAgentName(item.name)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{item.path}</p>
                </div>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                  {item.scope}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No startup agents found.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Memory Relief</p>
            <h3 className="mt-2 text-lg font-semibold">Close heavy processes safely</h3>
            <p className="mt-1 text-xs text-muted">Only processes owned by the current user can be terminated.</p>
          </div>
          <button
            type="button"
            onClick={() => void listMemoryProcesses()}
            className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">PID</th>
                <th className="px-3 py-2">Process</th>
                <th className="px-3 py-2">Mem %</th>
                <th className="px-3 py-2">RSS</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {memoryProcesses?.processes.length ? (
                memoryProcesses.processes.map((proc) => (
                  <tr key={proc.pid}>
                    <td className="px-3 py-2 text-muted">{proc.pid}</td>
                    <td className="px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-100">
                          {formatProcessLabel(proc.command)}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-muted" title={proc.command}>
                          {proc.command}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2">{proc.mem.toFixed(1)}</td>
                    <td className="px-3 py-2 text-muted">{formatBytes(proc.rssKb * 1024)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await terminateProcess(proc.pid);
                          if (ok) {
                            await listMemoryProcesses();
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-widest text-slate-100 transition hover:border-slate-500"
                      >
                        <Zap size={12} />
                        Close
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3 text-xs text-muted" colSpan={5}>
                    {memoryProcesses ? 'No processes returned.' : 'Loading process list…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-muted">
          Working…
        </div>
      ) : null}
    </div>
  );
};

export default MacCleanerPage;
