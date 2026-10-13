import "electron-log/preload";
import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, DesktopCommand } from "../shared/models";
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`media-post:${method}`, ...args);
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
  publishSettings: () => call("publishSettings"),
  setSilentPublish: (silent) => call("setSilentPublish", silent),
  setPublishSettings: (settings) => call("setPublishSettings", settings),
  profileSettings: () => call("profileSettings"),
  setProfile: (profile) => call("setProfile", profile),
  chooseAvatar: () => call("chooseAvatar"),
  onCommand: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, command: DesktopCommand) =>
      listener(command);
    ipcRenderer.on("media-post:command", receive);
    void call("rendererReady");
    return () => {
      ipcRenderer.removeListener("media-post:command", receive);
    };
  },
  accounts: () => call("accounts"),
  addAccount: (n, platform) => call("addAccount", n, platform),
  openAccount: (id) => call("openAccount", id),
  refreshAccount: (id) => call("refreshAccount", id),
  deleteAccount: (id) => call("deleteAccount", id),
  importMarkdown: () => call("importMarkdown"),
  chooseImages: (kind) => call("chooseImages", kind),
  saveDraft: (b, i, kind, title) => call("saveDraft", b, i, kind, title),
  loadDraft: () => call("loadDraft"),
  publish: (kind, title, b, i, t) => call("publish", kind, title, b, i, t),
  history: () => call("history"),
  openPost: (url) => call("openPost", url),
  verifyTarget: (id, url) => call("verifyTarget", id, url),
  retry: (id) => call("retry", id),
  resume: (id) => call("resume", id),
};
contextBridge.exposeInMainWorld("desktop", api);

// Read-only platform metadata lets CSS provide an opaque fallback outside macOS.
contextBridge.exposeInMainWorld("desktopPlatform", process.platform);
