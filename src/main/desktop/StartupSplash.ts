import { BrowserWindow, nativeTheme, screen } from "electron";
import { pathToFileURL } from "node:url";
import { startupSplashHtml } from "./startupSplashPage";

const SPLASH_SIZE = 280;

/** Frameless splash shown while the main window is still starting. */
export class StartupSplash {
  private window: BrowserWindow | null = null;

  open(iconPath: string) {
    if (this.window) return;
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const dark = nativeTheme.shouldUseDarkColors;
    const backgroundColor = dark ? "#000000" : "#f9f9f9";
    this.window = new BrowserWindow({
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      x: Math.round((width - SPLASH_SIZE) / 2),
      y: Math.round((height - SPLASH_SIZE) / 2),
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      backgroundColor,
      ...(process.platform === "darwin" ? { titleBarStyle: "hidden" as const } : {}),
    });
    const iconUrl = pathToFileURL(iconPath).href;
    const html = startupSplashHtml(iconUrl, dark);
    void this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    this.window.once("ready-to-show", () => {
      if (this.window && !this.window.isDestroyed()) this.window.showInactive();
    });
  }

  close() {
    const win = this.window;
    this.window = null;
    if (!win || win.isDestroyed()) return;
    win.close();
  }
}
