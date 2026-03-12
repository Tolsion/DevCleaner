import { useEffect, useMemo, useState } from "react";
import { useDevToolsStore } from "../../store/devToolsStore";
import LoadingOverlay from "../../components/LoadingOverlay";

const DevToolsPage = () => {
  const { tools, isLoading, error, fetchTools } = useDevToolsStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (tool) =>
        tool.label.toLowerCase().includes(q) ||
        tool.version.toLowerCase().includes(q),
    );
  }, [tools, query]);

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isLoading && tools.length === 0 ? (
        <LoadingOverlay label="Loading tools" />
      ) : null}
      <section className="rounded-2xl bg-surface/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mt-2 text-xl font-semibold">Installed tooling</h2>
            <p className="mt-2 text-sm text-muted">
              Python, Node.js, Docker, Git and more.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchTools()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by tool or version"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600"
          />
          <span className="text-xs text-muted">{filtered.length} shown</span>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-rose-300">
          {error}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((tool) => (
            <div
              key={tool.id}
              className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{tool.label}</p>
                  <p className="mt-1 text-xs text-muted">{tool.version}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    tool.available
                      ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border border-slate-700 bg-slate-900/40 text-slate-300"
                  }`}
                >
                  {tool.available ? "Installed" : "Missing"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DevToolsPage;
