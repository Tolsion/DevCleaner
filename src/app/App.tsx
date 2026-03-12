import { useEffect, useState } from "react";
import { FolderOpen, Play, RefreshCw } from "lucide-react";
import Layout, { type PageKey } from "../components/Layout";
import SplashScreen from "../components/SplashScreen";
import Dashboard from "../features/dashboard/Dashboard";
import CleanupPreviewPage from "../features/cleanup/CleanupPreviewPage";
import DevToolsPage from "../features/dev-tools/DevToolsPage";
import MacCleanerPage from "../features/mac-cleaner/MacCleanerPage";
import ApplicationsPage from "../features/applications/ApplicationsPage";
import SystemPage from "../features/system/SystemPage";
import SettingsPage from "../features/settings/SettingsPage";
import TrayWidget from "../features/system/TrayWidget";
import { useScanStore } from "../store/scanStore";
import { useSystemStore } from "../store/systemStore";
import { useToastStore } from "../store/toastStore";
import appPackage from "../../package.json";

const App = () => {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [showSplash, setShowSplash] = useState(true);
  const {
    isScanning,
    lastScanAt,
    roots,
    targets,
    ignore,
    startScan,
    setRoots,
    setScanError,
    hydrateTotals,
    hydrateSchedule,
    hydrateScanConfig,
  } = useScanStore();
  const { fetchInfo } = useSystemStore();
  const pushToast = useToastStore((state) => state.push);
  const navKey = "devcleaner:navigate";
  const pages: PageKey[] = [
    "dashboard",
    "system",
    "cleanup",
    "settings",
    "devtools",
    "mac-cleaner",
    "applications",
  ];

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowSplash(false), 2600);
    void hydrateTotals();
    void hydrateSchedule();
    void hydrateScanConfig();
    try {
      const versionKey = "devcleaner:lastVersion";
      const currentVersion = appPackage.version ?? "0.0.0";
      const lastVersion = window.localStorage.getItem(versionKey);
      if (lastVersion !== currentVersion) {
        window.localStorage.setItem(versionKey, currentVersion);
        pushToast({
          message: lastVersion
            ? `Updated to v${currentVersion}.`
            : `Welcome to Dev Cleaner v${currentVersion}.`,
          tone: "success",
        });
      }
    } catch {
      // ignore
    }
    const applyNavigation = () => {
      const raw = window.localStorage.getItem(navKey);
      if (!raw) return;
      let page: PageKey | null = null;
      try {
        const parsed = JSON.parse(raw);
        if (pages.includes(parsed?.page)) {
          page = parsed.page;
        }
      } catch {
        if (pages.includes(raw as PageKey)) {
          page = raw as PageKey;
        }
      }
      if (page) {
        setActivePage(page);
        window.localStorage.removeItem(navKey);
      }
    };

    applyNavigation();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === navKey) {
        applyNavigation();
      }
    };
    window.addEventListener("storage", handleStorage);
    const unsubscribe = window.devCleaner?.app?.onNavigate?.((payload) => {
      if (payload?.page && pages.includes(payload.page as PageKey)) {
        setActivePage(payload.page as PageKey);
      }
    });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", handleStorage);
      unsubscribe?.();
    };
  }, []);

  const handleScan = async () => {
    if (!roots.length) {
      setScanError("No scan roots selected. Use Pick Folders first.");
      return;
    }
    await startScan({ roots, targets, ignore });
  };

  const handlePickRoots = async () => {
    if (!window.devCleaner?.folders?.pick) {
      setScanError("Folder picker is unavailable (preload not connected).");
      return;
    }
    const response = await window.devCleaner.folders.pick();
    if (response.ok && response.data.length > 0) {
      setRoots(response.data);
    }
  };

  const formatTimestamp = (value: string | null) => {
    if (!value) return "No scans yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const header = (() => {
    switch (activePage) {
      case "dashboard":
        return {
          eyebrow: "Dev Cleaner Desktop",
          title: "Workspace Health Dashboard",
          subtitle: `Last run: ${formatTimestamp(lastScanAt)} · Root: ${
            roots.length ? roots.join(', ') : "Not set"
          }`,
          actions: (
            <>
              <button
                type="button"
                onClick={handlePickRoots}
                disabled={isScanning}
                className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <FolderOpen size={16} />
                Pick Folders
              </button>
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Play size={16} />
                {isScanning ? "Scanning…" : "Start Scan"}
              </button>
            </>
          ),
        };
      case "system":
        return {
          eyebrow: "System",
          title: "Device Telemetry",
          subtitle: "Realtime system diagnostics from the main process.",
          actions: (
            <button
              type="button"
              onClick={() => void fetchInfo()}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          ),
        };
      case "cleanup":
        return {
          eyebrow: "Cleanup",
          title: "Cleanup Preview",
          subtitle: "Review what would be removed before you clean.",
        };
      case "mac-cleaner":
        return {
          eyebrow: "Mac Cleaner",
          title: "System Maintenance",
          subtitle: "Home library cleanup, large files, and memory relief.",
        };
      case "settings":
        return {
          eyebrow: "Settings",
          title: "Preferences",
          subtitle: "Tune how DevCleaner scans and cleans.",
        };
      case "devtools":
        return {
          eyebrow: "Developer Stack",
          title: "Tool Versions",
          subtitle: "Installed runtimes, CLIs, and build tools.",
        };
      case "applications":
        return {
          eyebrow: "Applications",
          title: "Installed Apps",
          subtitle: "Review and remove applications from this Mac.",
        };
      default:
        return null;
    }
  })();

  const params = new URLSearchParams(window.location.search);
  const isTray =
    params.get("tray") === "1" ||
    window.location.hash === "#tray" ||
    window.location.hash === "#/tray";
  if (isTray) {
    return <TrayWidget />;
  }

  if (showSplash) {
    return <SplashScreen onDismiss={() => setShowSplash(false)} />;
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage} header={header}>
      {activePage === "dashboard" && <Dashboard />}
      {activePage === "system" && <SystemPage />}
      {activePage === "mac-cleaner" && <MacCleanerPage />}
      {activePage === "cleanup" && <CleanupPreviewPage />}
      {activePage === "applications" && <ApplicationsPage />}
      {activePage === "settings" && <SettingsPage />}
      {activePage === "devtools" && <DevToolsPage />}
    </Layout>
  );
};

export default App;
