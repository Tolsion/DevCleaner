import type { ScanProgress } from '../../../electron/shared/types/scan';

interface ScanningPanelProps {
  roots: string[];
  progress: ScanProgress | null;
}

const ScanningPanel = ({ roots, progress }: ScanningPanelProps) => {
  const percent = Math.min(Math.max(progress?.percent ?? 0, 0), 100);
  const message = progress?.message ?? 'Preparing scan...';
  const foundCount = progress?.foundCount ?? 0;
  const currentRoot = progress?.currentRoot;
  const currentPath = progress?.currentPath;
  const lastFoundProject = progress?.lastFoundProject;
  return (
    <section className="grid gap-6 rounded-2xl border border-slate-800 bg-surface/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Scan In Progress</p>
          <h2 className="mt-2 text-2xl font-semibold">Scanning workspace folders…</h2>
          <p className="mt-3 text-sm text-muted">
            Searching for <span className="font-semibold text-slate-200">node_modules</span>,{' '}
            <span className="font-semibold text-slate-200">dist</span>, and{' '}
            <span className="font-semibold text-slate-200">build</span> directories.
          </p>
        </div>
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-accent" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted">
          <span>Progress</span>
          <span>{percent}%</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{message}</span>
          <span>{foundCount} folders detected</span>
        </div>
        {currentRoot || currentPath ? (
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            {currentRoot ? <p>Root: {currentRoot}</p> : null}
            {lastFoundProject ? <p>Project: {lastFoundProject}</p> : null}
            {currentPath ? <p className="font-mono">{currentPath}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Roots</p>
        <ul className="mt-3 space-y-2 font-mono text-xs text-slate-200">
          {roots.map((root) => (
            <li key={root}>{root}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {['Scanning folders', 'Measuring sizes', 'Compiling results'].map((step) => (
          <div
            key={step}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200"
          >
            <div className="mb-3 h-2 w-2 animate-pulse rounded-full bg-accent" />
            {step}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ScanningPanel;
