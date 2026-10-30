import { ipcMain, WebContentsView, type BrowserWindow, type IpcMainEvent } from "electron";
import { join } from "node:path";
import type { NativeToastEvent, ToastOverlay } from "../../shared/models";
import sonnerStyles from "../../renderer/styles/sonner.css?raw";
import nativeStyles from "./nativeToast.css?raw";
import { installNativeToasts } from "./nativeToast";

const EDGE_PADDING = 12;
const toastDocument = `<!doctype html><html><head><meta charset="utf-8"><style>
${sonnerStyles}
${nativeStyles}
</style></head><body><div data-sonner-toaster data-native-toaster dir="ltr"></div>
<script>window.render = (${installNativeToasts.toString()})((event) => window.nativeToast.notify(event));</script>
</body></html>`;

export class ToastOverlayWindow {
  private view: WebContentsView | null = null;
  private ready: Promise<void> | null = null;
  private generation = 0;
  private payload?: ToastOverlay;
  private measuredHeight = 1;

  constructor(private parent: BrowserWindow) {
    ipcMain.on("mediax:toast-overlay-event", this.receive);
    parent.webContents.on("did-start-navigation", (_event, _url, _inPlace, isMainFrame) => {
      if (isMainFrame) this.hide();
    });
    parent.once("closed", () => {
      ipcMain.removeListener("mediax:toast-overlay-event", this.receive);
      this.hide();
    });
  }

  private receive = (event: IpcMainEvent, value: unknown) => {
    if (
      event.sender !== this.view?.webContents ||
      event.senderFrame !== event.sender.mainFrame ||
      !value ||
      typeof value !== "object"
    )
      return;
    const data = value as Partial<NativeToastEvent>;
    if (data.type === "resize" && typeof data.height === "number" && Number.isFinite(data.height)) {
      this.measuredHeight = Math.max(1, Math.ceil(data.height));
      this.layout();
    } else if (data.type === "empty") {
      if (!this.payload?.toasts.length) this.view?.setVisible(false);
    } else if (
      data.type === "dismiss" &&
      (data.reason === "timeout" || data.reason === "close") &&
      this.payload?.toasts.some((item) => item.id === data.id)
    ) {
      if (!this.parent.isDestroyed()) this.parent.webContents.send("mediax:toast-dismissed", data);
    }
  };

  private layout = () => {
    if (!this.view || !this.payload || this.parent.isDestroyed()) return;
    const [windowWidth, windowHeight] = this.parent.getContentSize();
    const width = Math.min(windowWidth, Math.round(this.payload.width) + EDGE_PADDING * 2);
    const bottom = Math.min(windowHeight, this.payload.y + this.payload.height + EDGE_PADDING);
    const height = Math.min(this.measuredHeight, Math.max(1, bottom));
    this.view.setBounds({
      x: Math.max(0, Math.min(windowWidth - width, Math.round(this.payload.x) - EDGE_PADDING)),
      y: Math.max(0, Math.round(bottom - height)),
      width,
      height,
    });
  };

  async show(payload: ToastOverlay) {
    const generation = ++this.generation;
    this.payload = payload;
    const view = this.ensure();
    await this.ready;
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    this.layout();
    await view.webContents.executeJavaScript(
      `window.render(${JSON.stringify({ ...payload, maxHeight: this.parent.getContentSize()[1] - 48 })})`,
    );
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    if (payload.toasts.length) {
      this.parent.contentView.addChildView(view);
      view.setVisible(true);
    }
  }

  hide() {
    this.generation++;
    const view = this.view;
    this.view = null;
    this.payload = undefined;
    this.ready = null;
    if (!view) return;
    if (!this.parent.isDestroyed()) this.parent.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private ensure() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/nativeToast.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
      },
    });
    this.view = view;
    view.setVisible(false);
    view.setBackgroundColor("#00000000");
    this.parent.contentView.addChildView(view);
    this.ready = view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(toastDocument)}`,
    );
    return view;
  }
}
