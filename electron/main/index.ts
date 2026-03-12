import { app, BrowserWindow, nativeImage } from "electron";
import { existsSync } from "node:fs";
import path from "path";
import { registerScanHandlers } from "./ipc/scan.handlers";
import { registerFolderHandlers } from "./ipc/folders.handlers";
import { registerSystemHandlers } from "./ipc/system.handlers";
import { registerDevToolsHandlers } from "./ipc/devtools.handlers";
import { registerAppHandlers } from "./ipc/app.handlers";
import { registerMacCleanerHandlers } from "./ipc/mac-cleaner.handlers";
import { registerStorageHandlers } from "./ipc/storage.handlers";
import { registerAppsHandlers } from "./ipc/apps.handlers";
import { startScanScheduler } from "./services/scan-scheduler.service";
import { initTray } from "./services/tray.service";
import { storageService } from "./services/storage.service";

let mainWindow: BrowserWindow | null = null;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let isQuitting = false;

const getPreloadPath = () => {
  const preloadCandidates = [
    path.join(__dirname, "../preload/index.cjs"),
    path.join(__dirname, "../preload/index.mjs"),
    path.join(__dirname, "../preload/index.js"),
    path.join(process.cwd(), "out/preload/index.cjs"),
    path.join(process.cwd(), "out/preload/index.mjs"),
    path.join(process.cwd(), "out/preload/index.js"),
    path.join(process.cwd(), "dist/preload/index.cjs"),
    path.join(process.cwd(), "dist/preload/index.mjs"),
    path.join(process.cwd(), "dist/preload/index.js"),
  ];

  return (
    preloadCandidates.find((candidate) => existsSync(candidate)) ??
    path.join(__dirname, "../preload/index.js")
  );
};

const resolveAssetPath = (filename: string) => {
  const candidates = [
    path.join(process.resourcesPath ?? "", "assets", filename),
    path.join(process.cwd(), "assets", filename),
    path.join(process.cwd(), filename),
    path.join(__dirname, "../assets", filename),
    path.join(__dirname, "../../assets", filename),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const getAppIconPath = () => {
  if (process.platform === "win32") {
    return (
      resolveAssetPath("dev_clean_color.ico") ??
      resolveAssetPath("dev_clean_color.png")
    );
  }
  return resolveAssetPath("dev_clean_color.png");
};
const getTrayIconPath = () =>
  resolveAssetPath("dev_cleaner_white.png") ??
  resolveAssetPath("dev_clean_white.png");

const createWindow = () => {
  const preloadPath = getPreloadPath();
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    show: false,
    backgroundColor: "#0b1430",
    titleBarStyle: "hiddenInset",
    title: "Dev Cleaner",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const isPreview = Boolean(process.env.ELECTRON_VITE_PREVIEW);
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else if (!app.isPackaged && !isPreview) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
};

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    app.setActivationPolicy("regular");
    app.dock?.show();
  }
  registerScanHandlers();
  registerFolderHandlers();
  registerSystemHandlers();
  registerMacCleanerHandlers();
  registerDevToolsHandlers();
  registerAppHandlers();
  registerStorageHandlers();
  registerAppsHandlers();
  startScanScheduler();
  createWindow();
  const appIconPath = getAppIconPath();
  if (appIconPath && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(appIconPath));
  }
  const isPreview = Boolean(process.env.ELECTRON_VITE_PREVIEW);
  const trayUrl = devServerUrl
    ? `${devServerUrl}?tray=1&ts=${Date.now()}#tray`
    : `file://${path.join(__dirname, "../renderer/index.html")}?tray=1#tray`;
  const traySettings = await storageService.getTraySettings();
  initTray({
    trayUrl,
    preloadPath: getPreloadPath(),
    trayIconPath: getTrayIconPath(),
    devServerUrl: devServerUrl ?? undefined,
    visible: traySettings.visible
  });

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
