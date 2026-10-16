// Keep this sandboxed entry self-contained; shared imports become unsupported require chunks.
import { contextBridge, ipcRenderer } from "electron";
import type { NativePopupHostEvent, NativePopupRequest } from "../shared/models";

/** Popup renderer may only notify the host; it must not invoke guarded desktop IPC. */
const api = {
  onNativePopup(listener: (popup: NativePopupRequest) => void) {
    const receive = (_event: Electron.IpcRendererEvent, popup: NativePopupRequest) =>
      listener(popup);
    ipcRenderer.on("mediax:native-popup", receive);
    return () => ipcRenderer.removeListener("mediax:native-popup", receive);
  },
  notifyNativePopup(event: { type: "resize"; height: number } | NativePopupHostEvent) {
    ipcRenderer.send("mediax:native-popup-notify", event);
  },
};

contextBridge.exposeInMainWorld("desktop", api);
contextBridge.exposeInMainWorld("desktopPlatform", process.platform);
