import { contextBridge, ipcRenderer } from "electron";
import type { NativeToastEvent } from "../shared/models";

contextBridge.exposeInMainWorld("nativeToast", {
  notify: (event: NativeToastEvent) => ipcRenderer.send("mediax:toast-overlay-event", event),
});
