import { app, BrowserWindow, Notification } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "../../shared/models";
import { readNotificationSettings } from "../../shared/notificationSettings";
import { log } from "../logging";
import type { Database } from "../storage/Database";

export class AppUpdater {
  private status: UpdateStatus = {
    state: "idle",
    currentVersion: app.getVersion(),
    availableVersion: null,
    progress: null,
    message: null,
    canCheck: false,
    canInstall: false,
  };
  private checking: Promise<UpdateStatus> | null = null;
  private notifications = new Set<Notification>();

  constructor(
    private window: BrowserWindow,
    private db?: Database,
  ) {
    autoUpdater.logger = {
      info: (message) => log.info(String(message)),
      warn: (message) => log.warn(String(message)),
      error: (message) => log.error(String(message)),
      debug: (message) => log.debug(String(message)),
    };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => {
      this.set({ state: "checking", message: "正在检查更新…", progress: null, canInstall: false });
    });
    autoUpdater.on("update-available", (info) => {
      this.set({
        state: "available",
        availableVersion: info.version,
        message: `发现新版本 ${info.version}，开始下载…`,
        progress: 0,
        canInstall: false,
      });
    });
    autoUpdater.on("update-not-available", () => {
      this.set({
        state: "not-available",
        availableVersion: null,
        message: "已是最新版本",
        progress: null,
        canInstall: false,
      });
    });
    autoUpdater.on("download-progress", (progress) => {
      this.set({
        state: "downloading",
        progress: Math.round(progress.percent),
        message: `正在下载更新 ${Math.round(progress.percent)}%`,
        canInstall: false,
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      this.set({
        state: "downloaded",
        availableVersion: info.version,
        progress: 100,
        message: `新版本 ${info.version} 已下载，重启后安装`,
        canInstall: true,
      });
      this.notify(`media-post ${info.version} 已就绪`, "点击通知或打开设置，重启以完成安装。");
    });
    autoUpdater.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.warn("Update check failed", error);
      this.set({
        state: "error",
        message,
        progress: null,
        canInstall: false,
      });
    });
  }

  start() {
    if (!app.isPackaged) {
      this.set({ message: "开发模式可点检查更新，但不会下载安装包。" });
      return;
    }
    setTimeout(() => {
      void this.check(false).catch((error) => log.warn("Background update check failed", error));
    }, 15_000);
  }

  getStatus() {
    return this.status;
  }

  async check(manual: boolean): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      this.set({
        state: "not-available",
        message: manual
          ? "开发模式不会从 GitHub 下载更新。"
          : "开发模式可点检查更新，但不会下载安装包。",
        canInstall: false,
      });
      return this.status;
    }
    if (this.checking) return this.checking;
    this.checking = (async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (!result && manual)
          this.set({
            state: "not-available",
            message: "未获取到更新信息",
            canInstall: false,
          });
        return this.status;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.set({ state: "error", message, canInstall: false, progress: null });
        if (manual) throw error;
        return this.status;
      } finally {
        this.checking = null;
      }
    })();
    return this.checking;
  }

  install(): UpdateStatus {
    if (this.status.state !== "downloaded") throw new Error("还没有可安装的更新");
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return this.status;
  }

  private set(patch: Partial<UpdateStatus>) {
    const next: UpdateStatus = {
      ...this.status,
      ...patch,
      currentVersion: app.getVersion(),
      canCheck: false,
      canInstall: false,
    };
    const busy = next.state === "checking" || next.state === "downloading";
    next.canCheck = !busy;
    next.canInstall = next.state === "downloaded";
    this.status = next;
    if (!this.window.isDestroyed())
      this.window.webContents.send("media-post:update-status", this.status);
  }

  private notify(title: string, body: string) {
    if (!Notification.isSupported()) return;
    if (this.db && !readNotificationSettings((key) => this.db!.setting(key)).enabled) return;
    const notification = new Notification({ title, body });
    this.notifications.add(notification);
    notification.on("close", () => this.notifications.delete(notification));
    notification.on("click", () => {
      if (this.window.isDestroyed()) return;
      if (this.window.isMinimized()) this.window.restore();
      this.window.show();
      this.window.focus();
      this.window.webContents.send("media-post:command", { action: "settings" });
    });
    notification.show();
  }
}
