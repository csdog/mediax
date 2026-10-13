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
  addAccount: (n) => call("addAccount", n),
  openAccount: (id) => call("openAccount", id),
  refreshAccount: (id) => call("refreshAccount", id),
  deleteAccount: (id) => call("deleteAccount", id),
  importMarkdown: () => call("importMarkdown"),
  chooseImages: () => call("chooseImages"),
  saveDraft: (b, i) => call("saveDraft", b, i),
  loadDraft: () => call("loadDraft"),
  publish: (b, i, t) => call("publish", b, i, t),
  history: () => call("history"),
  openPost: (url) => call("openPost", url),
  verifyTarget: (id, url) => call("verifyTarget", id, url),
  retry: (id) => call("retry", id),
  resume: (id) => call("resume", id),
};
contextBridge.exposeInMainWorld("desktop", api);

// Read-only platform metadata lets CSS provide an opaque fallback outside macOS.
contextBridge.exposeInMainWorld("desktopPlatform", process.platform);
