import { log } from "../logging";
import { WebContentsView, type BrowserWindow, type WebContents } from "electron";
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
    case "submit-omnibox":
      return typeof action.value === "string"
        ? { type: "submit-omnibox", value: action.value }
        : null;
    case "remove-history":
      return typeof action.url === "string" && /^https?:\/\//i.test(action.url)
        ? { type: "remove-history", url: action.url }
        : null;
    default:
      return null;
  }
}

// A local native view stacks above external account pages without a separate inactive window.
export class NativePopupView {
  private view: WebContentsView | null = null;
  private ready = false;
  private pending: NativePopupRequest | null = null;
  private height = 160;
  private kind: NativePopupRequest["kind"] | null = null;

  constructor(
    private parent: BrowserWindow,
    private emit: (event: NativePopupHostEvent) => void,
  ) {
    const dismiss = () => this.hide(true);
    parent.on("blur", dismiss);
    parent.on("move", dismiss);
    parent.on("resize", dismiss);
    parent.once("closed", () => {
      if (this.view && !this.view.webContents.isDestroyed()) this.view.webContents.close();
      this.view = null;
    });
  }

  show(request: NativePopupRequest) {
    if (this.parent.isDestroyed()) return;
    const view = this.ensure();
    if (request.kind !== this.kind) {
      this.height = request.kind === "extensions" ? 132 : 220;
      this.kind = request.kind;
    }
    this.pending = request;
    this.place(view, request);
    // Re-adding an existing child raises it above the active external page.
    this.parent.contentView.addChildView(view);
    if (this.ready) {
      view.webContents.send("mediax:native-popup", request);
      view.setVisible(true);
    }
  }

  rendererReady() {
    const view = this.view;
    if (!view || view.webContents.isDestroyed() || this.parent.isDestroyed()) return;
    this.ready = true;
    if (this.pending) {
      view.webContents.send("mediax:native-popup", this.pending);
      view.setVisible(true);
    }
    log.debug("Native popup renderer ready", { pending: this.pending?.kind });
  }

  resize(height: number) {
    const next = Math.max(48, Math.min(640, Math.round(height)));
    if (!this.pending || !this.view || Math.abs(next - this.height) < 2) return;
    this.height = next;
    this.place(this.view, this.pending);
  }

  owns(contents: WebContents) {
    return this.view?.webContents === contents;
  }

  hide(notify = false) {
    const wasOpen = this.pending !== null;
    this.pending = null;
    this.kind = null;
    if (this.view && !this.view.webContents.isDestroyed()) this.view.setVisible(false);
    if (wasOpen && notify) this.emit({ type: "closed" });
  }

  private place(view: WebContentsView, request: NativePopupRequest) {
    if (this.parent.isDestroyed() || view.webContents.isDestroyed()) return;
    view.setBounds({
      x: Math.round(request.x),
      y: Math.round(request.y),
      width: Math.round(request.width),
      height: this.height,
    });
  }

  private ensure() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
        preload: join(__dirname, "../preload/nativePopup.js"),
      },
    });
    this.view = view;
    this.ready = false;
    view.setVisible(false);
    view.setBackgroundColor("#00000000");
    this.parent.contentView.addChildView(view);
    view.webContents.on("did-start-loading", () => {
      this.ready = false;
    });
    view.webContents.on("focus", () => {
      if (this.kind !== "history" || !this.pending || this.parent.isDestroyed()) return;
      // A native child can take OS focus even when DOM mousedown is prevented.
      // History suggestions belong to the omnibox, which remains the keyboard owner.
      this.parent.webContents.focus();
      this.emit({ type: "focus-omnibox" });
    });
    view.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (
        this.kind === "history" &&
        (input.control || input.meta) &&
        input.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        return;
      }
      if (input.key !== "Escape") return;
      event.preventDefault();
      this.hide(true);
      if (!this.parent.isDestroyed()) this.parent.webContents.focus();
    });
    view.webContents.on("preload-error", (_event, _path, error) =>
      log.error("Native popup preload failed", error),
    );
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL("native-popup.html", process.env.ELECTRON_RENDERER_URL);
      void view.webContents.loadURL(url.toString());
    } else {
      void view.webContents.loadFile(join(__dirname, "../renderer/native-popup.html"));
    }
    return view;
  }
}
