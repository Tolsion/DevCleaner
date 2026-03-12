import { useEffect, useState } from "react";
import { ArrowUpRight, Leaf, Settings } from "lucide-react";
import { useScanStore } from "../../store/scanStore";
import { useSystemStore } from "../../store/systemStore";
import { useToastStore } from "../../store/toastStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import logoWhite from "../../assets/dev_cleaner_white.png";

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

const TrayWidget = () => {
  const { info, isLoading, error, fetchInfo, fetchPowerSaving, setPowerSaving } = useSystemStore();
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
    const prefsInterval = window.setInterval(() => void hydrateTraySettings(), 5000);
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
  const batteryStatus = info?.battery?.hasBattery
    ? info.battery.isCharging === null
      ? "Status unknown"
      : info.battery.isCharging
        ? "Charging"
        : "Discharging"
    : "No battery detected";

  useEffect(() => {
    if (info?.powerSavingEnabled !== null && info?.powerSavingEnabled !== undefined) {
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
        message: result.error ?? 'Power saving toggle failed. Try running the app with admin permissions.',
        tone: 'error'
      });
    }
    setPowerSavingBusy(false);
  };

  return (
    <div className="h-full bg-canvas p-3 text-slate-100">
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <img
            src={logoWhite}
            alt="Dev Cleaner"
            className="h-7 w-7 object-contain"
          />
          <div>
            <p className="text-xs font-semibold text-white">Dev Cleaner</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
              System Widget
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleOpenSettings()}
            title="Settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900/40 text-slate-100 transition hover:bg-slate-900/80"
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={() => void handleOpenApp()}
            title="Open App"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900/40 text-slate-100 transition hover:bg-slate-900/80"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-xs text-rose-300">{error}</p> : null}

      {info ? (
        <div className="mt-3 space-y-2">
          {traySettings.sections.disk ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Disk</span>
                <span>{diskPercent.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {formatBytes(diskUsed)} used / {formatBytes(info.diskTotalBytes)}{" "}
                total
              </p>
            </div>
          ) : null}

          {traySettings.sections.memory ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Memory</span>
                <span>{memPercent.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${memPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {formatBytes(memUsed)} used / {formatBytes(info.totalMemBytes)}{" "}
                total
              </p>
              {swapUsed > 0 ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>Swap Pressure</span>
                    <span>
                      {formatBytes(swapUsed)} / {formatBytes(swapTotal)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${swapPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {traySettings.sections.cpu ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>CPU</span>
                <span>{cpuPercent.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${cpuPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {info.cpuCount} cores · {info.cpuModel}
              </p>
            </div>
          ) : null}

          {traySettings.sections.battery ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Battery</span>
                <div className="flex items-center gap-2">
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
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      powerSavingEnabled
                        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:text-slate-100"
                    } ${powerSavingBusy ? "opacity-60" : ""}`}
                  >
                    <Leaf size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${
                    powerSavingEnabled ? "bg-emerald-400" : "bg-slate-600"
                  }`}
                  style={{ width: `${batteryPercent ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {batteryMinutes && batteryMinutes > 0
                  ? `${Math.floor(batteryMinutes / 60)}h ${
                      batteryMinutes % 60
                    }m remaining`
                  : info?.battery?.avgTimeToEmptyMinutes && info.battery.avgTimeToEmptyMinutes > 0
                    ? `${Math.floor(info.battery.avgTimeToEmptyMinutes / 60)}h ${
                        info.battery.avgTimeToEmptyMinutes % 60
                      }m avg to empty`
                    : "Time remaining unknown"}
              </p>
              <p className="mt-1 text-[10px] text-muted">{batteryStatus}</p>
              <p className="mt-1 text-[10px] text-muted">
                {info?.battery?.externalConnected === null
                  ? "Power: Unknown"
                  : info?.battery?.externalConnected
                    ? "Power: Connected"
                    : "Power: Not connected"}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                {info?.battery?.voltageMv
                  ? `${info.battery.voltageMv} mV`
                  : "Voltage unknown"}{" "}
                ·{" "}
                {info?.battery?.amperageMa
                  ? `${info.battery.amperageMa} mA`
                  : "Amperage unknown"}
              </p>
            </div>
          ) : null}

          {traySettings.sections.latestScan ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Latest Scan</span>
                <span>
                  {lastScanAt
                    ? new Date(lastScanAt).toLocaleDateString()
                    : "None"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {results.items.length} projects · {formatBytes(totalJunkBytes)}{" "}
                junk
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startScan({ roots, targets, ignore })}
                  disabled={isScanning || roots.length === 0}
                  className="rounded-lg border border-slate-700 bg-slate-900/40 px-2.5 py-1.5 text-[10px] font-semibold text-slate-100 transition hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isScanning ? "Scanning…" : "Start Scan"}
                </button>
              </div>
            </div>
          ) : null}

          {junkWarning && traySettings.sections.warning ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-[10px] text-rose-100">
              Warning: Junk size exceeded 3 GB. Consider cleaning soon.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Disk</span>
              <span className="h-3 w-8 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-2/3 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-40 rounded-full bg-slate-800/80" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Memory</span>
              <span className="h-3 w-8 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/2 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-40 rounded-full bg-slate-800/80" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>CPU</span>
              <span className="h-3 w-10 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-3/5 rounded-full bg-slate-700/80 animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-32 rounded-full bg-slate-800/80" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Latest Scan</span>
              <span className="h-3 w-16 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-2 w-44 rounded-full bg-slate-800/80" />
            <div className="mt-3 h-6 w-24 rounded-lg bg-slate-800/80" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Battery</span>
              <span className="h-3 w-10 rounded-full bg-slate-800/80" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
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
