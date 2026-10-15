import { BrowserWindow } from "electron";
import type { ToastOverlay } from "../../shared/models";
import type { PreviewRect } from "./preview-slide";

const toastDocument = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  body {
    font: 500 13px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif;
    color: #0d0d0d;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    box-sizing: border-box;
    padding: 0;
  }
  .toast {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid #ebebeb;
    background: #fff;
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  }
  .toast[data-type="success"] { background: hsl(143 85% 96%); border-color: hsl(145 92% 87%); color: hsl(140 100% 27%); }
  .toast[data-type="info"] { background: hsl(208 100% 97%); border-color: hsl(221 91% 93%); color: hsl(210 92% 45%); }
  .toast[data-type="warning"] { background: hsl(49 100% 97%); border-color: hsl(49 91% 84%); color: hsl(31 92% 45%); }
  .toast[data-type="error"] { background: hsl(359 100% 97%); border-color: hsl(359 100% 94%); color: hsl(360 100% 45%); }
  .copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .title { margin: 0; font-weight: 500; overflow-wrap: anywhere; }
  .description { margin: 0; font-weight: 400; line-height: 1.4; opacity: 0.85; overflow-wrap: anywhere; }
</style>
</head>
<body>
<script>
function render(data) {
  document.body.replaceChildren();
  for (const item of data.toasts || []) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.type = item.type || "default";
    toast.setAttribute("role", "status");
    const copy = document.createElement("div");
    copy.className = "copy";
    if (item.title) {
      const title = document.createElement("p");
      title.className = "title";
      title.textContent = item.title;
      copy.append(title);
    }
    if (item.description) {
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = item.description;
      copy.append(description);
    }
    toast.append(copy);
    document.body.append(toast);
  }
  return [...document.body.children].reduce((height, toast) => height + toast.getBoundingClientRect().height, 0)
    + Math.max(0, document.body.children.length - 1) * 8;
}
</script>
</body>
</html>`;

// A child window stacks above the account WebContentsView, same pattern as tab preview.
export class ToastOverlayWindow {
  private window: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;
  private generation = 0;
  private listening = false;

  constructor(private parent: BrowserWindow) {}

  async show(payload: ToastOverlay) {
    const generation = ++this.generation;
    const win = this.ensure();
    await this.ready;
    if (generation !== this.generation || win.isDestroyed() || this.parent.isDestroyed()) return;
    win.setBounds(this.screenBounds(payload));
    if (win.webContents.isDestroyed()) return;
    const height: number = await win.webContents.executeJavaScript(
      `render(${JSON.stringify(payload)})`,
    );
    if (generation !== this.generation || win.isDestroyed()) return;
    const bounds = this.screenBounds(payload);
    const measuredHeight = Math.max(1, Math.ceil(height));
    win.setBounds({
      ...bounds,
      y: bounds.y + bounds.height - measuredHeight,
      height: measuredHeight,
    });
    if (!win.isVisible()) win.showInactive();
  }

  hide() {
    this.generation++;
    const win = this.window;
    this.window = null;
    this.ready = null;
    if (win && !win.isDestroyed()) win.destroy();
  }

  private screenBounds(payload: ToastOverlay): PreviewRect {
    const content = this.parent.getContentBounds();
    return {
      x: Math.round(content.x + payload.x),
      y: Math.round(content.y + payload.y),
      width: Math.max(1, Math.round(payload.width)),
      height: Math.max(1, Math.round(payload.height)),
    };
  }

  private ensure() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    const win = new BrowserWindow({
      parent: this.parent,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      closable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      roundedCorners: true,
      backgroundColor: "#00000000",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
      },
    });
    win.setIgnoreMouseEvents(true);
    this.ready = win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(toastDocument)}`);
    if (!this.listening) {
      this.listening = true;
      this.parent.once("closed", () => this.hide());
    }
    this.window = win;
    return win;
  }
}
