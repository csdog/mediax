import "electron-log/preload";
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopApi, DesktopCommand } from "../shared/models";
import { userErrorMessage } from "../shared/userError";
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`mediax:${method}`, ...args).catch((error: unknown) => {
    throw new Error(userErrorMessage(error));
  });
const api: DesktopApi = {
  workspaceSession: () => call("workspaceSession"),
  saveWorkspaceSession: (session) => call("saveWorkspaceSession", session),
  previewAccountBrowser: (id) => call("previewAccountBrowser", id),
  openWebBrowser: (id, url) => call("openWebBrowser", id, url),
  resolveOmniboxUrl: (input) => call("resolveOmniboxUrl", input),
  webSearchProvider: () => call("webSearchProvider"),
  browserNavigation: (id) => call("browserNavigation", id),
  onBrowserNavigationChanged: (listener) => {
    const receive = (
      _event: Electron.IpcRendererEvent,
      id: string,
      navigation: Parameters<typeof listener>[1],
    ) => listener(id, navigation);
    ipcRenderer.on("mediax:browser-navigation-changed", receive);
    return () => ipcRenderer.removeListener("mediax:browser-navigation-changed", receive);
  },
  browserHistory: (query) => call("browserHistory", query),
  removeBrowserHistory: (url) => call("removeBrowserHistory", url),
  navigateBrowser: (id, url) => call("navigateBrowser", id, url),
  goBackBrowser: (id) => call("goBackBrowser", id),
  goForwardBrowser: (id) => call("goForwardBrowser", id),
  reloadBrowser: (id) => call("reloadBrowser", id),
  browserZoom: (id) => call("browserZoom", id),
  setBrowserZoom: (id, factor) => call("setBrowserZoom", id, factor),
  printBrowser: (id) => call("printBrowser", id),
  findInBrowser: (id, query, options) => call("findInBrowser", id, query, options),
  stopFindInBrowser: (id) => call("stopFindInBrowser", id),
  screenshotBrowser: (id) => call("screenshotBrowser", id),
  clearBrowserData: (id) => call("clearBrowserData", id),
  layoutAccountBrowser: (id, bounds) => call("layoutAccountBrowser", id, bounds),
  showTabPreview: (preview) => call("showTabPreview", preview),
  hideTabPreview: () => call("hideTabPreview"),
  showToastOverlay: (overlay) => call("showToastOverlay", overlay),
  hideToastOverlay: () => call("hideToastOverlay"),
  showNativePopup: (popup) => {
    ipcRenderer.send("mediax:native-popup-host-show", popup);
    return Promise.resolve();
  },
  hideNativePopup: () => {
    ipcRenderer.send("mediax:native-popup-host-hide");
    return Promise.resolve();
  },
  onNativePopup: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, popup: Parameters<typeof listener>[0]) =>
      listener(popup);
    ipcRenderer.on("mediax:native-popup", receive);
    return () => ipcRenderer.removeListener("mediax:native-popup", receive);
  },
  onNativePopupHostEvent: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, event: Parameters<typeof listener>[0]) =>
      listener(event);
    ipcRenderer.on("mediax:native-popup-event", receive);
    return () => ipcRenderer.removeListener("mediax:native-popup-event", receive);
  },
  notifyNativePopup: (event) => ipcRenderer.send("mediax:native-popup-notify", event),
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
  accountGroups: () => call("accountGroups"),
  setAccountGroups: (id, groupIds) => call("setAccountGroups", id, groupIds),
  createAccountGroup: (input) => call("createAccountGroup", input),
  accounts: () => call("accounts"),
  addAccount: (n, platform) => call("addAccount", n, platform),
  openAccount: (id, url) => call("openAccount", id, url),
  refreshAccount: (id) => call("refreshAccount", id),
  deleteAccount: (id) => call("deleteAccount", id),
  importMarkdown: () => call("importMarkdown"),
  chooseImages: (kind) => call("chooseImages", kind),
  importLocalFiles: (paths, kind) => call("importLocalFiles", paths, kind),
  revealInFolder: (path) => call("revealInFolder", path),
  openDownloadsFolder: () => call("openDownloadsFolder"),
  downloads: () => call("downloads"),
  removeDownload: (id) => call("removeDownload", id),
  revealDownload: (id) => call("revealDownload", id),
  copyDownloadUrl: (id) => call("copyDownloadUrl", id),
  copyDownloadPath: (id) => call("copyDownloadPath", id),
  onDownloadsChanged: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, items: Parameters<typeof listener>[0]) =>
      listener(items);
    ipcRenderer.on("mediax:downloads-changed", receive);
    return () => {
      ipcRenderer.removeListener("mediax:downloads-changed", receive);
    };
  },
  openExternalUrl: (url) => call("openExternalUrl", url),
  pathForFile: (file) => webUtils.getPathForFile(file),
  saveDraft: (b, i, kind, title) => call("saveDraft", b, i, kind, title),
  loadDraft: () => call("loadDraft"),
  publish: (kind, title, b, i, t, scheduledAt) =>
    call("publish", kind, title, b, i, t, scheduledAt ?? null),
  publishBatches: (kind, images, batches, scheduledAt) =>
    call("publishBatches", kind, images, batches, scheduledAt ?? null),
  history: () => call("history"),
  calendar: (range) => call("calendar", range),
  rescheduleTask: (taskId, scheduledAt) => call("rescheduleTask", taskId, scheduledAt),
  analyticsSummary: (query) => call("analyticsSummary", query),
  openPost: (url) => call("openPost", url),
  verifyTarget: (id, url) => call("verifyTarget", id, url),
  retry: (id) => call("retry", id),
  republish: (id) => call("republish", id),
  resume: (id) => call("resume", id),
};
contextBridge.exposeInMainWorld("desktop", api);
contextBridge.exposeInMainWorld("trayDrop", {
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  setHot: (hot: boolean) => ipcRenderer.send("mediax:tray-drop-hot", hot),
  dropped: (paths: string[]) => ipcRenderer.send("mediax:tray-drop-files", paths),
});

// Read-only platform metadata lets CSS provide an opaque fallback outside macOS.
contextBridge.exposeInMainWorld("desktopPlatform", process.platform);
