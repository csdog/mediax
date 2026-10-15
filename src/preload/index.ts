import "electron-log/preload";
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopApi, DesktopCommand } from "../shared/models";
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`mediax:${method}`, ...args);
const api: DesktopApi = {
  workspaceSession: () => call("workspaceSession"),
  saveWorkspaceSession: (session) => call("saveWorkspaceSession", session),
  previewAccountBrowser: (id) => call("previewAccountBrowser", id),
  layoutAccountBrowser: (id, bounds) => call("layoutAccountBrowser", id, bounds),
  showTabPreview: (preview) => call("showTabPreview", preview),
  hideTabPreview: () => call("hideTabPreview"),
  closeAccountBrowser: (id) => call("closeAccountBrowser", id),
  shortcutSettings: () => call("shortcutSettings"),
  setGlobalShortcut: (accelerator) => call("setGlobalShortcut", accelerator),
  setShortcut: (id, accelerator) => call("setShortcut", id, accelerator),
  resetShortcuts: () => call("resetShortcuts"),
  updateStatus: () => call("updateStatus"),
  checkForUpdates: () => call("checkForUpdates"),
  installUpdate: () => call("installUpdate"),
  autoUpdateEnabled: () => call("autoUpdateEnabled"),
  setAutoUpdateEnabled: (enabled) => call("setAutoUpdateEnabled", enabled),
  desktopBehavior: () => call("desktopBehavior"),
  setDesktopBehavior: (settings) => call("setDesktopBehavior", settings),
  onUpdateStatus: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, status: Parameters<typeof listener>[0]) =>
      listener(status);
    ipcRenderer.on("mediax:update-status", receive);
    return () => {
      ipcRenderer.removeListener("mediax:update-status", receive);
    };
  },
  publishSettings: () => call("publishSettings"),
  setSilentPublish: (silent) => call("setSilentPublish", silent),
  setPublishSettings: (settings) => call("setPublishSettings", settings),
  profileSettings: () => call("profileSettings"),
  setProfile: (profile) => call("setProfile", profile),
  chooseAvatar: () => call("chooseAvatar"),
  notificationSettings: () => call("notificationSettings"),
  setNotificationSettings: (settings) => call("setNotificationSettings", settings),
  notificationPermission: () => call("notificationPermission"),
  openNotificationSettings: () => call("openNotificationSettings"),
  testNotification: () => call("testNotification"),
  themePreference: () => call("themePreference"),
  setThemePreference: (preference) => call("setThemePreference", preference),
  diagnostics: () => call("diagnostics"),
  storageUsage: (force) => call("storageUsage", force),
  clearStorage: (id) => call("clearStorage", id),
  exportDiagnostics: () => call("exportDiagnostics"),
  revealLogFile: () => call("revealLogFile"),
  openAtLogin: () => call("openAtLogin"),
  setOpenAtLogin: (openAtLogin) => call("setOpenAtLogin", openAtLogin),
  onCommand: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, command: DesktopCommand) =>
      listener(command);
    ipcRenderer.on("mediax:command", receive);
    void call("rendererReady");
    return () => {
      ipcRenderer.removeListener("mediax:command", receive);
    };
  },
  accounts: () => call("accounts"),
  addAccount: (n, platform) => call("addAccount", n, platform),
  openAccount: (id) => call("openAccount", id),
  refreshAccount: (id) => call("refreshAccount", id),
  deleteAccount: (id) => call("deleteAccount", id),
  importMarkdown: () => call("importMarkdown"),
  chooseImages: (kind) => call("chooseImages", kind),
  importLocalFiles: (paths, kind) => call("importLocalFiles", paths, kind),
  revealInFolder: (path) => call("revealInFolder", path),
  pathForFile: (file) => webUtils.getPathForFile(file),
  saveDraft: (b, i, kind, title) => call("saveDraft", b, i, kind, title),
  loadDraft: () => call("loadDraft"),
  publish: (kind, title, b, i, t, scheduledAt) =>
    call("publish", kind, title, b, i, t, scheduledAt ?? null),
  history: () => call("history"),
  calendar: (range) => call("calendar", range),
  rescheduleTask: (taskId, scheduledAt) => call("rescheduleTask", taskId, scheduledAt),
  analyticsSummary: (days) => call("analyticsSummary", days),
  openPost: (url) => call("openPost", url),
  verifyTarget: (id, url) => call("verifyTarget", id, url),
  retry: (id) => call("retry", id),
  resume: (id) => call("resume", id),
};
contextBridge.exposeInMainWorld("desktop", api);

// Read-only platform metadata lets CSS provide an opaque fallback outside macOS.
contextBridge.exposeInMainWorld("desktopPlatform", process.platform);
