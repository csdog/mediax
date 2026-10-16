import { BrowserWindow, type WebContents } from "electron";
import { join } from "node:path";
import type {
  NativePopupAction,
  NativePopupHostEvent,
  NativePopupRequest,
} from "../../shared/models";

const kinds = new Set(["downloads", "extensions", "history", "browser-menu"]);

export function parseNativePopup(value: unknown): NativePopupRequest {
  if (!value || typeof value !== "object") throw new Error("无效弹层");
  const popup = value as NativePopupRequest;
  if (!kinds.has(popup.kind)) throw new Error("无效弹层");
  if (popup.theme !== "light" && popup.theme !== "dark") throw new Error("无效弹层");
  if (typeof popup.focus !== "boolean") throw new Error("无效弹层");
  for (const key of ["x", "y", "width"] as const) {
    if (typeof popup[key] !== "number" || !Number.isFinite(popup[key])) throw new Error("无效弹层");
  }
  if (popup.width < 120 || popup.width > 1200) throw new Error("无效弹层");
  return popup;
}

export function parseNativePopupAction(value: unknown): NativePopupAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as NativePopupAction;
  switch (action.type) {
    case "open-downloads-folder":
    case "find":
    case "print":
    case "zoom-reset":
    case "screenshot":
    case "clear-data":
    case "show-downloads":
    case "settings":
      return { type: action.type };
    case "zoom":
      return typeof action.delta === "number" && Number.isFinite(action.delta)
        ? { type: "zoom", delta: action.delta }
        : null;
    case "reveal-download":
    case "copy-download-url":
    case "copy-download-path":
    case "remove-download":
      return typeof action.id === "string" && action.id
        ? { type: action.type, id: action.id }
        : null;
    case "open-history":
      return typeof action.url === "string" && /^https?:\/\//i.test(action.url)
        ? { type: "open-history", url: action.url }
        : null;
    default:
      return null;
  }
}

// A child window stacks above the account WebContentsView, so the popup can cover the page.
export class NativePopupWindow {
  private window: BrowserWindow | null = null;
  private ready = false;
  private pending: NativePopupRequest | null = null;
  private height = 160;
  private kind: NativePopupRequest["kind"] | null = null;
  private openedAt = 0;

  constructor(
    private parent: BrowserWindow,
    private emit: (event: NativePopupHostEvent) => void,
  ) {}

  show(request: NativePopupRequest) {
    const win = this.ensure();
    if (request.kind !== this.kind) {
      this.height = request.kind === "extensions" ? 132 : 220;
      this.kind = request.kind;
    }
    this.pending = request;
    this.place(win, request);
    win.setFocusable(request.focus);
    if (this.ready && !win.webContents.isDestroyed()) {
      win.webContents.send("mediax:native-popup", request);
    }
    if (!win.isVisible()) {
      this.openedAt = Date.now();
      if (request.focus) win.show();
      else win.showInactive();
      return;
    }
    if (request.focus) win.focus();
    else if (!this.parent.isDestroyed()) this.parent.focus();
  }

  resize(height: number) {
    const next = Math.max(48, Math.min(640, Math.round(height)));
    if (!this.pending || !this.window || Math.abs(next - this.height) < 2) return;
    this.height = next;
    this.place(this.window, this.pending);
  }

  owns(contents: WebContents) {
    return this.window?.webContents === contents;
  }

  hide(notify = false) {
    const wasOpen = this.pending !== null || Boolean(this.window?.isVisible());
    if (!wasOpen) return;
    this.pending = null;
    this.kind = null;
    const win = this.window;
    if (win && !win.isDestroyed() && win.isVisible()) win.hide();
    if (notify) this.emit({ type: "closed" });
  }

  private place(win: BrowserWindow, request: NativePopupRequest) {
    if (this.parent.isDestroyed() || win.isDestroyed()) return;
    const content = this.parent.getContentBounds();
    win.setBounds({
      x: Math.round(content.x + request.x),
      y: Math.round(content.y + request.y),
      width: Math.round(request.width),
      height: this.height,
    });
  }

  private ensure() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    const win = new BrowserWindow({
      parent: this.parent,
      frame: false,
      transparent: true,
      hasShadow: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      closable: false,
      skipTaskbar: true,
      show: false,
      roundedCorners: true,
      backgroundColor: "#00000000",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
        preload: join(__dirname, "../preload/nativePopup.js"),
      },
    });
    win.on("blur", () => {
      if (!this.pending?.focus || Date.now() - this.openedAt < 200) return;
      this.hide(true);
    });
    const dismiss = () => {
      if (Date.now() - this.openedAt < 200) return;
      this.hide(true);
    };
    this.parent.on("move", dismiss);
    this.parent.on("resize", dismiss);
    win.webContents.on("did-finish-load", () => {
      this.ready = true;
      if (this.pending && !win.webContents.isDestroyed()) {
        win.webContents.send("mediax:native-popup", this.pending);
      }
    });
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL("native-popup.html", process.env.ELECTRON_RENDERER_URL);
      void win.loadURL(url.toString());
    } else {
      void win.loadFile(join(__dirname, "../renderer/native-popup.html"));
    }
    this.parent.once("closed", () => {
      if (!win.isDestroyed()) win.destroy();
    });
    this.window = win;
    return win;
  }
}
