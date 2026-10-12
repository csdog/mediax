import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/models";
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`media-post:${method}`, ...args);
const api: DesktopApi = {
  accounts: () => call("accounts"),
  addAccount: (n) => call("addAccount", n),
  openAccount: (id) => call("openAccount", id),
  refreshAccount: (id) => call("refreshAccount", id),
  importMarkdown: () => call("importMarkdown"),
  chooseImages: () => call("chooseImages"),
  saveDraft: (b, i) => call("saveDraft", b, i),
  loadDraft: () => call("loadDraft"),
  publish: (b, i, t) => call("publish", b, i, t),
  history: () => call("history"),
  retry: (id) => call("retry", id),
  resume: (id) => call("resume", id),
};
contextBridge.exposeInMainWorld("desktop", api);
