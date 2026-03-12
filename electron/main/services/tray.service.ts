import { BrowserWindow, Tray, nativeImage, screen } from "electron";

type TrayInitOptions = {
  trayUrl: string;
  preloadPath: string;
  trayIconPath: string | null;
  devServerUrl?: string;
  visible: boolean;
};

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let trayRefreshTimer: NodeJS.Timeout | null = null;
let trayUrl: string | null = null;
let preloadPath: string | null = null;
let trayIconPath: string | null = null;
let devServerUrl: string | undefined;

const createTrayWindow = () => {
  if (!trayUrl || !preloadPath) return;
  trayWindow = new BrowserWindow({
    width: 380,
    height: 540,
    show: false,
    frame: false,
    resizable: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0b1430",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  trayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  trayWindow.setAlwaysOnTop(true, "pop-up-menu");
  trayWindow.loadURL(trayUrl);

  trayWindow.on("blur", () => {
    trayWindow?.hide();
    if (trayRefreshTimer) {
      clearInterval(trayRefreshTimer);
      trayRefreshTimer = null;
    }
  });
};

const toggleTrayWindow = () => {
  if (!tray || !trayWindow) return;
  if (trayWindow.isVisible()) {
    trayWindow.hide();
    if (trayRefreshTimer) {
      clearInterval(trayRefreshTimer);
      trayRefreshTimer = null;
    }
    return;
  }
  const trayBounds = tray.getBounds();
  const { width, height } = trayWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const workArea = display.workArea;

  const rawX = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
  const clampedX = Math.max(
    workArea.x,
    Math.min(rawX, workArea.x + workArea.width - width),
  );
  const belowY = Math.round(trayBounds.y + trayBounds.height + 6);
  const aboveY = Math.round(trayBounds.y - height - 6);
  const clampedY =
    belowY + height <= workArea.y + workArea.height
      ? belowY
      : Math.max(workArea.y, aboveY);

  trayWindow.setPosition(clampedX, clampedY, false);
  trayWindow.show();
  trayWindow.focus();
  if (devServerUrl) {
    setTimeout(() => {
      if (trayWindow?.isDestroyed()) return;
      trayWindow.webContents.reloadIgnoringCache();
    }, 150);
    if (!trayRefreshTimer) {
      trayRefreshTimer = setInterval(() => {
        if (trayWindow?.isVisible()) {
          trayWindow.webContents.reloadIgnoringCache();
        }
      }, 15000);
    }
  }
};

const createTray = () => {
  const image = trayIconPath
    ? nativeImage.createFromPath(trayIconPath)
    : nativeImage.createFromDataURL(
        `data:image/svg+xml;base64,${Buffer.from(
          `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path fill="white" d="M3 2h10v2H3zM2 6h12v8H2z"/>
            <path fill="white" d="M5 9h6v1H5z"/>
          </svg>`,
        ).toString("base64")}`,
      );
  const trayImage = image.resize({ width: 24, height: 24 });
  trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setImage(trayImage);
  tray.setPressedImage(trayImage);
  tray.setToolTip("Dev Cleaner");
  tray.on("click", toggleTrayWindow);
  createTrayWindow();
};

const destroyTray = () => {
  if (trayRefreshTimer) {
    clearInterval(trayRefreshTimer);
    trayRefreshTimer = null;
  }
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.close();
  }
  trayWindow = null;
  tray?.destroy();
  tray = null;
};

export const initTray = (options: TrayInitOptions) => {
  trayUrl = options.trayUrl;
  preloadPath = options.preloadPath;
  trayIconPath = options.trayIconPath;
  devServerUrl = options.devServerUrl;
  if (options.visible) {
    if (!tray) createTray();
  } else {
    destroyTray();
  }
};

export const setTrayVisible = (visible: boolean) => {
  if (visible) {
    if (!tray) createTray();
  } else {
    destroyTray();
  }
  return Boolean(tray);
};
