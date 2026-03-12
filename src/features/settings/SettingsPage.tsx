import { useEffect, useMemo, useState } from 'react';
import { Github, Globe, Info } from 'lucide-react';
import appPackage from '../../../package.json';
import { useScanStore } from '../../store/scanStore';
import { useToastStore } from '../../store/toastStore';
import { usePreferencesStore } from '../../store/preferencesStore';

const formatTimestamp = (value: string | null) => {
  if (!value) return 'No scans yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const SettingsPage = () => {
  const {
    lastScanAt,
    targets,
    ignore,
    setTargets,
    setIgnore,
    totalCleanedBytes,
    totalCleanedFolders,
    totalCleanedProjects,
    resetTotals,
    scheduleEnabled,
    scheduleIntervalMinutes,
    setScanSchedule
  } = useScanStore();
  const [ignoreInput, setIgnoreInput] = useState(ignore.join(', '));
  const [confirmReset, setConfirmReset] = useState(false);
  const pushToast = useToastStore((state) => state.push);
  const { traySettings, hydrateTraySettings, setTrayVisible, toggleTraySection } =
    usePreferencesStore();

  useEffect(() => {
    void hydrateTraySettings();
  }, [hydrateTraySettings]);

  const isTargetEnabled = useMemo(() => {
    const set = new Set(targets);
    return {
      node: set.has('node_modules'),
      build: set.has('build') || set.has('dist'),
      cache: set.has('.cache') || set.has('.turbo') || set.has('coverage'),
      next: set.has('.next')
    };
  }, [targets]);

  const toggleTarget = (value: string, enabled: boolean) => {
    const next = new Set(targets);
    if (enabled) {
      next.add(value);
    } else {
      next.delete(value);
    }
    setTargets(Array.from(next));
  };

  const junkCatalog = [
    {
      id: 'node',
      label: 'Node.js / React',
      items: ['node_modules', 'dist', 'build', '.cache', '.turbo', 'coverage']
    },
    {
      id: 'next',
      label: 'Next.js',
      items: ['.next']
    },
    {
      id: 'reactnative',
      label: 'React Native / Expo',
      items: ['node_modules', 'android/build', 'ios/build', '.expo', '.expo-shared', '.metro-cache']
    },
    {
      id: 'php',
      label: 'PHP / Laravel',
      items: ['vendor', 'storage/logs', 'storage/framework/cache', 'storage/framework/sessions', 'storage/framework/views']
    },
    {
      id: 'cpp',
      label: 'C / C++',
      items: ['build', 'cmake-build-debug', 'cmake-build-release', 'CMakeFiles']
    },
    {
      id: 'python',
      label: 'Python',
      items: ['.venv', '__pycache__', '.mypy_cache', '.pytest_cache', '.tox']
    },
    {
      id: 'r',
      label: 'R',
      items: ['.Rproj.user']
    },
    {
      id: 'ruby',
      label: 'Ruby',
      items: ['vendor/bundle', '.bundle', 'tmp', 'log']
    },
    {
      id: 'go',
      label: 'Go',
      items: ['bin', 'pkg', '.cache/go-build']
    },
    {
      id: 'electron',
      label: 'Electron / Desktop',
      items: ['dist', 'out', 'release', '.electron', '.vite', '.electron-vite', 'src-tauri/target']
    },
    {
      id: 'flutter',
      label: 'Flutter',
      items: ['build', '.dart_tool', '.flutter-plugins', '.flutter-plugins-dependencies']
    },
    {
      id: 'qt',
      label: 'Qt',
      items: ['build', '.qmake.stash', '.qmlcache', 'qmlcache', 'CMakeFiles', 'cmake-build-debug', 'cmake-build-release']
    }
  ];

  const isGroupEnabled = (items: string[]) => items.every((item) => targets.includes(item));

  const toggleGroup = (items: string[], enabled: boolean) => {
    const next = new Set(targets);
    if (enabled) {
      items.forEach((item) => next.add(item));
    } else {
      items.forEach((item) => next.delete(item));
    }
    setTargets(Array.from(next));
  };

  const updateIgnore = (value: string) => {
    setIgnoreInput(value);
    const list = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setIgnore(list);
  };

  const scheduleOptions = [
    { label: 'Every 10 minutes', value: 10 },
    { label: 'Every 6 hours', value: 360 },
    { label: 'Every 12 hours', value: 720 },
    { label: 'Daily', value: 1440 },
    { label: 'Weekly', value: 10080 }
  ];

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

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Scan Defaults</h3>
          <div className="mt-4 space-y-4 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Include node_modules</span>
              <input
                type="checkbox"
                checked={isTargetEnabled.node}
                onChange={(event) => toggleTarget('node_modules', event.target.checked)}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Include build/dist</span>
              <input
                type="checkbox"
                checked={isTargetEnabled.build}
                onChange={(event) => {
                  toggleTarget('build', event.target.checked);
                  toggleTarget('dist', event.target.checked);
                }}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Include caches</span>
              <input
                type="checkbox"
                checked={isTargetEnabled.cache}
                onChange={(event) => {
                  toggleTarget('.cache', event.target.checked);
                  toggleTarget('.turbo', event.target.checked);
                  toggleTarget('coverage', event.target.checked);
                }}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Include .next</span>
              <input
                type="checkbox"
                checked={isTargetEnabled.next}
                onChange={(event) => toggleTarget('.next', event.target.checked)}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Cleanup Safety</h3>
          <div className="mt-4 space-y-4 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Ask before deleting</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-sky-400" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Move to Trash</span>
              <input type="checkbox" className="h-4 w-4 accent-sky-400" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Keep logs</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-sky-400" />
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Scan Locations</h3>
        <p className="mt-3 text-sm text-muted">
          Use the “Pick Folders” button in the dashboard to update your scan roots.
        </p>
        <p className="mt-3 text-xs text-muted">Last scan: {formatTimestamp(lastScanAt)}</p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Menu Bar</h3>
        <p className="mt-3 text-sm text-muted">
          Control whether the menu bar widget is visible and which cards it shows.
        </p>
        <div className="mt-4 space-y-4 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted">Show menu bar widget</span>
            <input
              type="checkbox"
              checked={traySettings.visible}
              onChange={(event) => void setTrayVisible(event.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
          </label>
          <div className="grid gap-3 text-sm">
            {(
              [
                { key: 'disk', label: 'Disk usage' },
                { key: 'memory', label: 'Memory usage' },
                { key: 'cpu', label: 'CPU load' },
                { key: 'battery', label: 'Battery status' },
                { key: 'latestScan', label: 'Latest scan' },
                { key: 'warning', label: '3 GB warning' }
              ] as const
            ).map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-3">
                <span className="text-muted">{item.label}</span>
                <input
                  type="checkbox"
                  checked={traySettings.sections[item.key]}
                  onChange={(event) => void toggleTraySection(item.key, event.target.checked)}
                  disabled={!traySettings.visible}
                  className="h-4 w-4 accent-sky-400 disabled:opacity-60"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Scheduled Scans</h3>
        <p className="mt-3 text-sm text-muted">
          Run system scans automatically in the background while the app is running.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted">Enable scheduled scans</span>
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(event) =>
                setScanSchedule({
                  enabled: event.target.checked,
                  intervalMinutes: scheduleIntervalMinutes
                })
              }
              className="h-4 w-4 accent-sky-400"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted">Scan interval</span>
            <select
              value={scheduleIntervalMinutes}
              onChange={(event) =>
                setScanSchedule({
                  enabled: scheduleEnabled,
                  intervalMinutes: Number(event.target.value)
                })
              }
              disabled={!scheduleEnabled}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scheduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">
            Scans use the same targets and ignore list configured on this page.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Junk Libraries</h3>
        <p className="mt-3 text-sm text-muted">
          Select which ecosystems to scan. The app will always look for the folders listed under each
          ecosystem.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          {junkCatalog.map((group) => (
            <label key={group.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-slate-100">{group.label}</p>
                <p className="mt-1 text-xs text-muted">{group.items.join(', ')}</p>
              </div>
              <input
                type="checkbox"
                checked={isGroupEnabled(group.items)}
                onChange={(event) => toggleGroup(group.items, event.target.checked)}
                className="mt-1 h-4 w-4 accent-sky-400"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Ignore Folders</h3>
        <p className="mt-3 text-sm text-muted">
          Comma-separated folder names to skip during scan.
        </p>
        <input
          type="text"
          value={ignoreInput}
          onChange={(event) => updateIgnore(event.target.value)}
          placeholder="e.g. vendor, .venv, .idea"
          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600"
        />
        {ignore.length > 0 ? (
          <p className="mt-2 text-xs text-muted">Ignoring: {ignore.join(', ')}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm uppercase tracking-[0.3em] text-muted">Cleanup Totals</h3>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-900/60"
          >
            Reset Totals
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          {formatBytes(totalCleanedBytes)} cleaned · {totalCleanedProjects} projects · {totalCleanedFolders} folders
        </p>
        <p className="mt-2 text-xs text-muted">This data is stored locally on this device.</p>
      </section>

      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Reset Totals</p>
            <h3 className="mt-2 text-xl font-semibold">Cleanup totals will be cleared</h3>
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
                  pushToast({ message: 'Cleanup totals reset.', tone: 'success' });
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
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted">About</h3>
        <p className="mt-3 text-sm text-slate-200">
          Dev Clean is a Tolsion product built to keep developer workspaces fast, tidy, and
          distraction-free by surfacing heavy artifacts and helping you clean them safely.
        </p>
        <div className="mt-4 grid gap-2 text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <Info size={14} />
            <span>Version {appPackage.version}</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} />
            <span>Product: {appPackage.build?.productName ?? 'Dev Clean'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} />
            <span>Environment: {import.meta.env.MODE}</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} />
            <span>Platform: {navigator.platform}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <a
            href="https://tolsion.com"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-200 transition hover:bg-slate-900/60"
          >
            <Globe size={14} />
            tolsion.com
          </a>
          <a
            href="https://github.com/tolsion"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-200 transition hover:bg-slate-900/60"
          >
            <Github size={14} />
            github.com/tolsion
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-rose-200">Quit</h3>
        <p className="mt-3 text-sm text-rose-100">
          Close Dev Clean and stop background monitoring.
        </p>
        <button
          type="button"
          onClick={() => void window.devCleaner?.app?.quit?.()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
        >
          Quit App
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
