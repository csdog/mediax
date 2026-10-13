import { app, BrowserWindow } from "electron";
import type { AppUpdater as ElectronAutoUpdater } from "electron-updater";
import type { UpdateStatus } from "../../shared/models";
import { readAutoUpdateEnabled } from "../../shared/autoUpdateSettings";
import { readNotificationSettings } from "../../shared/notificationSettings";
import { log } from "../logging";
import type { Database } from "../storage/Database";
import { presentNotification } from "./presentNotification";

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
  private autoUpdaterPromise: Promise<ElectronAutoUpdater> | null = null;
  private wired = false;

  constructor(
    private window: BrowserWindow,
    private db?: Database,
  ) {}

  private async autoUpdater() {
    if (!this.autoUpdaterPromise) {
      this.autoUpdaterPromise = import("electron-updater").then((module) => module.autoUpdater);
    }
    const autoUpdater = await this.autoUpdaterPromise;
    if (!this.wired) {
      this.wired = true;
      autoUpdater.logger = {
        info: (message) => log.info(String(message)),
        warn: (message) => log.warn(String(message)),
        error: (message) => log.error(String(message)),
        debug: (message) => log.debug(String(message)),
      };
      autoUpdater.autoDownload = this.autoUpdateEnabled();
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("checking-for-update", () => {
        this.set({
          state: "checking",
          message: "正在检查更新…",
          progress: null,
          canInstall: false,
        });
      });
      autoUpdater.on("update-available", (info) => {
        const downloading = autoUpdater.autoDownload;
        this.set({
          state: "available",
          availableVersion: info.version,
          message: downloading
            ? `发现新版本 ${info.version}，开始下载…`
            : `发现新版本 ${info.version}；自动下载已关闭，可点「检查更新」下载。`,
          progress: downloading ? 0 : null,
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
        this.notify(`MediaX ${info.version} 已就绪`, "点击通知或打开设置，重启以完成安装。");
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
    return autoUpdater;
  }

  start() {
    if (!app.isPackaged) {
      this.set({ message: "开发模式可点检查更新，但不会下载安装包。" });
      return;
    }
    if (!this.autoUpdateEnabled()) {
      this.set({ message: "已关闭自动更新：启动时不检查、不自动下载；仍可手动检查。" });
      return;
    }
    setTimeout(() => {
      if (!this.autoUpdateEnabled()) return;
      void this.check(false).catch((error) => log.warn("Background update check failed", error));
    }, 15_000);
  }

  autoUpdateEnabled() {
    return this.db ? readAutoUpdateEnabled((key) => this.db!.setting(key)) : true;
  }

  setAutoUpdateEnabled(enabled: boolean) {
    this.db?.setSetting("autoUpdateEnabled", enabled);
    void this.autoUpdater().then((autoUpdater) => {
      autoUpdater.autoDownload = enabled;
    });
    this.set({
      message: enabled
        ? "已开启：启动后自动检查，发现新版本后自动下载。"
        : "已关闭：启动时不检查、不自动下载；仍可手动检查更新。",
    });
    return enabled;
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
    const autoUpdater = await this.autoUpdater();
    // Auto mode: check + download. Manual "检查更新" always downloads if a release exists.
    autoUpdater.autoDownload = manual || this.autoUpdateEnabled();
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
        autoUpdater.autoDownload = this.autoUpdateEnabled();
      }
    })();
    return this.checking;
  }

  install(): UpdateStatus {
    if (this.status.state !== "downloaded") throw new Error("还没有可安装的更新");
    void this.autoUpdater().then((autoUpdater) => {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    });
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
      this.window.webContents.send("mediax:update-status", this.status);
  }

  private notify(title: string, body: string) {
    if (!this.db) return;
    const prefs = readNotificationSettings((key) => this.db!.setting(key));
    if (!prefs.enabled) return;
    void presentNotification(this.window, {
      title,
      body,
      silent: !prefs.sound,
      onClick: () => {
        if (this.window.isDestroyed()) return;
        if (this.window.isMinimized()) this.window.restore();
        this.window.show();
        this.window.focus();
        this.window.webContents.send("mediax:command", { action: "settings" });
      },
    });
  }
}
