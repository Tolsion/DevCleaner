import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Battery,
  Cpu,
  HardDrive,
  Leaf,
  MemoryStick,
  Plug,
  ScanSearch,
  Settings,
} from "lucide-react";
import { useScanStore } from "../../store/scanStore";
import { useSystemStore } from "../../store/systemStore";
import { useToastStore } from "../../store/toastStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import logoWhite from "../../assets/dev_cleaner_white.png";

const shellClass =
  "h-full bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.08),transparent_28%),linear-gradient(180deg,rgba(11,18,32,0.25)_0%,rgba(15,23,40,0.25)_48%,rgba(11,17,32,0.25)_100%)] p-3 text-slate-100 backdrop-blur-[22px]";
const headerClass =
  "flex items-center justify-between rounded-[20px] bg-[linear-gradient(180deg,rgba(15,23,42,0.34),rgba(15,23,42,0.24))] px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl";
const sectionCardClass =
  "rounded-xl bg-[linear-gradient(180deg,rgba(15,23,42,0.34),rgba(15,23,42,0.24))] p-2.5 shadow-[0_10px_24px_rgba(2,6,23,0.1),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-2xl";
const metricTrackClass =
  "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/85";
const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-100 transition hover:bg-white/[0.12]";
const mutedLabelClass =
  "text-[10px] uppercase tracking-[0.24em] text-slate-400/80";
const mutedTextClass = "text-[10px] text-slate-400/90";
const titleRowClass = `flex items-center justify-between ${mutedTextClass}`;
const titleLabelClass = "inline-flex items-center gap-1.5";

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

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "Unknown";
  return `${value.toFixed(1)}%`;
};

const TrayWidget = () => {
  const {
    info,
    isLoading,
    error,
    fetchInfo,
    fetchPowerSaving,
    setPowerSaving,
  } = useSystemStore();
  const pushToast = useToastStore((state) => state.push);
  const { traySettings, hydrateTraySettings } = usePreferencesStore();
  const {
    results,
    lastScanAt,
    roots,
    targets,
    ignore,
    startScan,
    refreshResults,
    isScanning,
  } = useScanStore();

  useEffect(() => {
    void hydrateTraySettings();
    void fetchInfo();
    void fetchPowerSaving().then((value) => {
      if (value !== null) {
        setPowerSavingEnabled(value);
      }
    });
    void refreshResults();
    const interval = window.setInterval(() => void fetchInfo(), 5000);
    const scanInterval = window.setInterval(() => void refreshResults(), 5000);
    const prefsInterval = window.setInterval(
      () => void hydrateTraySettings(),
      5000,
    );
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "devcleaner:traySettings") {
        void hydrateTraySettings();
      }
    };
    window.addEventListener("storage", handleStorage);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void window.devCleaner?.app?.hideTray?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(scanInterval);
      window.clearInterval(prefsInterval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fetchInfo, refreshResults, hydrateTraySettings]);

  const diskUsed = info ? info.diskTotalBytes - info.diskFreeBytes : 0;
  const diskPercent = info
    ? clampPercent((diskUsed / info.diskTotalBytes) * 100)
    : 0;
  const memUsed = info ? info.totalMemBytes - info.freeMemBytes : 0;
  const memPercent = info
    ? clampPercent((memUsed / info.totalMemBytes) * 100)
    : 0;
  const swapUsed = info?.swapUsedBytes ?? 0;
  const swapTotal = info?.swapTotalBytes ?? 0;
  const swapPercent =
    swapTotal > 0 ? clampPercent((swapUsed / swapTotal) * 100) : 0;
  const cpuPercent = info ? clampPercent(info.cpuUsagePercent) : 0;
  const totalJunkBytes = results.items.reduce(
    (sum, item) => sum + item.junkSizeBytes,
    0,
  );
  const junkWarning = totalJunkBytes >= 3 * 1024 * 1024 * 1024;
  const [powerSavingEnabled, setPowerSavingEnabled] = useState(false);
  const [powerSavingBusy, setPowerSavingBusy] = useState(false);
  const batteryPercent =
    info?.battery?.hasBattery && info.battery.percent !== null
      ? clampPercent(info.battery.percent)
      : null;
  const batteryMinutes = info?.battery?.timeRemainingMinutes ?? null;
  const batteryCharging = info?.battery?.hasBattery
    ? info.battery.isCharging === true
    : false;
  const gpuAvailable = Boolean(
    info?.gpu?.available || info?.gpu?.model || info?.gpu?.renderer,
  );
  const gpuUsage = info?.gpu?.utilizationPercent ?? null;
  const gpuModel = info?.gpu?.model ?? "Unknown GPU";
  const gpuVram = info?.gpu?.vramMb
    ? `${Math.round(info.gpu.vramMb / 1024)} GB`
    : null;

  useEffect(() => {
    if (
      info?.powerSavingEnabled !== null &&
      info?.powerSavingEnabled !== undefined
    ) {
      setPowerSavingEnabled(info.powerSavingEnabled);
    }
  }, [info?.powerSavingEnabled]);

  const handleOpenApp = async () => {
    await window.devCleaner.app.showMain();
  };

  const handleOpenSettings = async () => {
    if (window.devCleaner?.app?.navigate) {
      await window.devCleaner.app.navigate({ page: "settings" });
      return;
    }
    window.localStorage.setItem(
      "devcleaner:navigate",
      JSON.stringify({ page: "settings", ts: Date.now() }),
    );
    await window.devCleaner.app.showMain();
  };

  const handleTogglePowerSaving = async () => {
    const nextValue = !powerSavingEnabled;
    setPowerSavingBusy(true);
    const result = await setPowerSaving(nextValue);
    if (result.ok) {
      setPowerSavingEnabled(nextValue);
      await fetchInfo();
    } else {
      pushToast({
        message:
          result.error ??
          "Power saving toggle failed. Try running the app with admin permissions.",
        tone: "error",
      });
    }
    setPowerSavingBusy(false);
  };

  return (
    <div className={shellClass}>
      <div className={headerClass}>
        <div className="flex items-center gap-2">
          <img
            src={logoWhite}
            alt="Dev Cleaner"
            className="h-7 w-7 object-contain opacity-95"
          />
          <div>
            <p className="text-xs font-semibold text-white">Dev Cleaner</p>
            <p className={mutedLabelClass}>System Widget</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleOpenSettings()}
            title="Settings"
            className={iconButtonClass}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={() => void handleOpenApp()}
            title="Open App"
            className={iconButtonClass}
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-xs text-rose-300">{error}</p> : null}

      {info ? (
        <div className="mt-3 space-y-2">
          {traySettings.sections.disk ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <HardDrive size={11} className="text-slate-400/80" />
                  <span>Disk</span>
                </span>
                <span>{diskPercent.toFixed(0)}%</span>
              </div>
              <div className={metricTrackClass}>
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#10b981)]"
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>
                {formatBytes(diskUsed)} used /{" "}
                {formatBytes(info.diskTotalBytes)} total
              </p>
            </div>
          ) : null}

          {traySettings.sections.memory ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <MemoryStick size={11} className="text-slate-400/80" />
                  <span>Memory</span>
                </span>
                <span>{memPercent.toFixed(0)}%</span>
              </div>
              <div className={metricTrackClass}>
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#38bdf8)]"
                  style={{ width: `${memPercent}%` }}
                />
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>
                {formatBytes(memUsed)} used / {formatBytes(info.totalMemBytes)}{" "}
                total
              </p>
              {swapUsed > 0 ? (
                <div className="mt-2">
                  <div className={titleRowClass}>
                    <span className={titleLabelClass}>
                      <MemoryStick size={11} className="text-slate-400/80" />
                      <span>Swap Pressure</span>
                    </span>
                    <span>
                      {formatBytes(swapUsed)} / {formatBytes(swapTotal)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/85">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24,#f59e0b)]"
                      style={{ width: `${swapPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {traySettings.sections.cpu ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <Cpu size={11} className="text-slate-400/80" />
                  <span>CPU</span>
                </span>
                <span>{cpuPercent.toFixed(1)}%</span>
              </div>
              <div className={metricTrackClass}>
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#fb7185)]"
                  style={{ width: `${cpuPercent}%` }}
                />
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>
                {info.cpuCount} cores · {info.cpuModel}
              </p>
            </div>
          ) : null}

          {gpuAvailable ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <Cpu size={11} className="text-slate-400/80" />
                  <span>GPU</span>
                </span>
                <span>{formatPercent(gpuUsage)}</span>
              </div>
              <div className={metricTrackClass}>
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#60a5fa)]"
                  style={{ width: `${clampPercent(gpuUsage ?? 0)}%` }}
                />
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>{gpuModel}</p>
              {gpuVram ? (
                <p className={`mt-1 ${mutedTextClass}`}>VRAM {gpuVram}</p>
              ) : null}
            </div>
          ) : null}

          {traySettings.sections.battery ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <Battery size={11} className="text-slate-400/80" />
                  <span>Battery</span>
                </span>
                <div className="flex items-center gap-2">
                  {batteryCharging ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Plug size={11} />
                    </span>
                  ) : null}
                  <span>
                    {batteryPercent !== null
                      ? `${batteryPercent.toFixed(0)}%`
                      : "—"}
                  </span>
                  <button
                    type="button"
                    aria-pressed={powerSavingEnabled}
                    onClick={() => void handleTogglePowerSaving()}
                    disabled={powerSavingBusy}
                    title="Power Saving"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 transition ${
                      powerSavingEnabled
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
                    } ${powerSavingBusy ? "opacity-60" : ""}`}
                  >
                    <Leaf size={14} />
                  </button>
                </div>
              </div>
              <div className={metricTrackClass}>
                <div
                  className={`h-full rounded-full ${
                    batteryCharging
                      ? "bg-[linear-gradient(90deg,#22c55e,#14b8a6)]"
                      : powerSavingEnabled
                        ? "bg-[linear-gradient(90deg,#34d399,#10b981)]"
                        : "bg-[linear-gradient(90deg,#64748b,#475569)]"
                  }`}
                  style={{ width: `${batteryPercent ?? 0}%` }}
                />
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>
                {batteryMinutes && batteryMinutes > 0
                  ? `${Math.floor(batteryMinutes / 60)}h ${
                      batteryMinutes % 60
                    }m remaining`
                  : info?.battery?.avgTimeToEmptyMinutes &&
                      info.battery.avgTimeToEmptyMinutes > 0
                    ? `${Math.floor(info.battery.avgTimeToEmptyMinutes / 60)}h ${
                        info.battery.avgTimeToEmptyMinutes % 60
                      }m avg to empty`
                    : "Time remaining unknown"}
              </p>
            </div>
          ) : null}

          {traySettings.sections.latestScan ? (
            <div className={sectionCardClass}>
              <div className={titleRowClass}>
                <span className={titleLabelClass}>
                  <ScanSearch size={11} className="text-slate-400/80" />
                  <span>Latest Scan</span>
                </span>
                <span>
                  {lastScanAt
                    ? new Date(lastScanAt).toLocaleDateString()
                    : "None"}
                </span>
              </div>
              <p className={`mt-1 ${mutedTextClass}`}>
                {results.items.length} projects · {formatBytes(totalJunkBytes)}{" "}
                junk
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startScan({ roots, targets, ignore })}
                  disabled={isScanning || roots.length === 0}
                  className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isScanning ? "Scanning…" : "Start Scan"}
                </button>
              </div>
            </div>
          ) : null}

          {junkWarning && traySettings.sections.warning ? (
            <div className="rounded-xl bg-rose-500/12 p-2.5 text-[10px] text-rose-100 shadow-[0_10px_24px_rgba(127,29,29,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
              Warning: Junk size exceeded 3 GB. Consider cleaning soon.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className={sectionCardClass}>
            <div className={titleRowClass}>
              <span className={titleLabelClass}>
                <HardDrive size={11} className="text-slate-400/80" />
                <span>Disk</span>
              </span>
              <span className="h-3 w-8 rounded-full bg-slate-800/80" />
            </div>
            <div className={metricTrackClass}>
              <div className="h-full w-2/3 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-40 rounded-full bg-slate-800/80" />
          </div>

          <div className={sectionCardClass}>
            <div className={titleRowClass}>
              <span className={titleLabelClass}>
                <MemoryStick size={11} className="text-slate-400/80" />
                <span>Memory</span>
              </span>
              <span className="h-3 w-8 rounded-full bg-slate-800/80" />
            </div>
            <div className={metricTrackClass}>
              <div className="h-full w-1/2 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-40 rounded-full bg-slate-800/80" />
          </div>

          <div className={sectionCardClass}>
            <div className={titleRowClass}>
              <span className={titleLabelClass}>
                <Cpu size={11} className="text-slate-400/80" />
                <span>CPU</span>
              </span>
              <span className="h-3 w-10 rounded-full bg-slate-800/80" />
            </div>
            <div className={metricTrackClass}>
              <div className="h-full w-3/5 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-32 rounded-full bg-slate-800/80" />
          </div>

          <div className={sectionCardClass}>
            <div className={titleRowClass}>
              <span className={titleLabelClass}>
                <ScanSearch size={11} className="text-slate-400/80" />
                <span>Latest Scan</span>
              </span>
              <span className="h-3 w-16 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-2 w-44 rounded-full bg-slate-800/80" />
            <div className="mt-3 h-6 w-24 rounded-lg bg-slate-800/80" />
          </div>

          <div className={sectionCardClass}>
            <div className={titleRowClass}>
              <span className={titleLabelClass}>
                <Battery size={11} className="text-slate-400/80" />
                <span>Battery</span>
              </span>
              <span className="h-3 w-10 rounded-full bg-slate-800/80" />
            </div>
            <div className={metricTrackClass}>
              <div className="h-full w-1/2 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-32 rounded-full bg-slate-800/80" />
          </div>
        </div>
      )}
    </div>
  );
};

export default TrayWidget;
