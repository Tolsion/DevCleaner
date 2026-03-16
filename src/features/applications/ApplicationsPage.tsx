import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import { useAppsStore } from "../../store/appsStore";
import LoadingOverlay from "../../components/LoadingOverlay";
import {
  detectRendererOsFamily,
  getFileBrowserName,
  getPlatformDisplayName,
  getTrashLabel,
} from "../../app/platform";

const formatDate = (value: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const ApplicationsPage = () => {
  const {
    apps,
    supported,
    isLoading,
    error,
    fetchApps,
    uninstallApp,
    revealApp,
  } = useAppsStore();
  const [query, setQuery] = useState("");
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  const platform = detectRendererOsFamily();
  const fileBrowserName = getFileBrowserName(platform);
  const platformName = getPlatformDisplayName(platform);
  const trashLabel = getTrashLabel(platform);

  useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((app) => app.name.toLowerCase().includes(q));
  }, [apps, query]);

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isLoading && apps.length === 0 ? (
        <LoadingOverlay label="Loading apps" />
      ) : null}
      <section className="rounded-2xl border-slate-800 bg-surface/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mt-2 text-xl font-semibold">
              Search Installed Apps
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void fetchApps()}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-900/60"
          >
            Refresh
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search applications"
          className="mt-4 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600"
        />
      </section>

      {!supported ? (
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-muted">
          Application listing is not available on {platformName}.
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-rose-300">
          {error}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No applications found.</p>
        ) : (
          <div className="divide-y divide-slate-800 text-sm">
            {filtered.map((app) => (
              <div
                key={`${app.path || app.name}-${app.version ?? "unknown"}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl ">
                    {app.iconDataUrl ? (
                      <img
                        src={app.iconDataUrl}
                        alt={`${app.name} icon`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                        App
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{app.name}</p>
                    <p className="mt-1 text-xs text-muted">{app.path || "Path unavailable"}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                      <span>Installed: {formatDate(app.installedAt)}</span>
                    </div>
                    <div className="flex justify-start items-center gap-3 text-xs text-muted">
                      <span className="text-white">
                        Size:{" "}
                        {app.sizeBytes
                          ? `${(app.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                          : "Unknown"}
                      </span>
                      {app.version ? <span>Version: {app.version}</span> : null}
                      {app.bundleId ? (
                        <span>Bundle ID: {app.bundleId}</span>
                      ) : null}
                      {app.publisher ? (
                        <span>Publisher: {app.publisher}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void revealApp(app.path)}
                    disabled={!app.path}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/70"
                  >
                    <FolderOpen size={14} />
                    Show in {fileBrowserName}
                  </button>
                  {app.uninstallSupported ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPath(app.path)}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                    >
                      <Trash2 size={14} />
                      Uninstall
                    </button>
                  ) : (
                    <span className="text-xs text-muted">
                      {app.uninstallHint ?? `Uninstall inside ${platformName}.`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {confirmPath ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Uninstall App
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              Move application to {trashLabel}?
            </h3>
            <p className="mt-2 text-sm text-muted">
              The app files will be moved to {trashLabel}. You can restore them
              before emptying it.
            </p>
            <p className="mt-3 text-xs text-slate-300">{confirmPath}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPath(null)}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await uninstallApp(confirmPath);
                  setConfirmPath(null);
                }}
                className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Move to {trashLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationsPage;
