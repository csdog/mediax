import { BrowserWindow, nativeTheme, type Rectangle } from "electron";
import { pathToFileURL } from "node:url";
import { startupSplashHtml } from "./startupSplashPage";

/** Full-size transparent splash while the main window is still starting. */
export class StartupSplash {
  private window: BrowserWindow | null = null;

  open(iconPath: string, bounds: Rectangle) {
    if (this.window) {
      this.align(bounds);
      return;
    }
    const material = process.platform === "darwin" && !nativeTheme.prefersReducedTransparency;
    this.window = new BrowserWindow({
      ...bounds,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      show: false,
      backgroundColor: material
        ? "#00000000"
        : nativeTheme.shouldUseDarkColors
          ? "#000000"
          : "#f9f9f9",
      ...(process.platform === "darwin"
        ? {
            titleBarStyle: "hidden" as const,
            ...(material
              ? { vibrancy: "menu" as const, visualEffectState: "active" as const }
              : {}),
          }
        : {}),
    });
    const iconUrl = pathToFileURL(iconPath).href;
    const html = startupSplashHtml(iconUrl);
    void this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    this.window.once("ready-to-show", () => {
      if (this.window && !this.window.isDestroyed()) this.window.showInactive();
    });
  }

  align(bounds: Rectangle) {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setBounds(bounds);
  }

  close() {
    const win = this.window;
    this.window = null;
    if (!win || win.isDestroyed()) return;
    win.close();
  }
}
