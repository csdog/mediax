import { WebContentsView, type BrowserWindow } from "electron";
import type { ToastOverlay } from "../../shared/models";
import sonnerStyles from "../../renderer/styles/sonner.css?raw";

const EDGE_PADDING = 8;

const toastDocument = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${sonnerStyles}
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  body { box-sizing: border-box; padding: ${EDGE_PADDING}px; }
  [data-sonner-toaster] {
    position: static; width: 100%; transform: none; display: flex;
    flex-direction: column-reverse; gap: 8px; --width: 100%;
  }
  [data-sonner-toast][data-styled="true"] {
    position: relative; opacity: 1; transform: none; transition: none;
    flex-shrink: 0; box-sizing: border-box;
  }
  [data-sonner-toast] [data-icon] img { width: 20px; height: 20px; }
  [data-sonner-toast][data-type="loading"] [data-icon] img { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div data-sonner-toaster dir="ltr"></div>
<script>
function render(data) {
  const host = document.querySelector("[data-sonner-toaster]");
  host.replaceChildren();
  host.style.width = data.width + "px";
  host.dataset.sonnerTheme = data.theme || "light";
  for (const item of data.toasts || []) {
    const toast = document.createElement("div");
    toast.dataset.sonnerToast = "";
    toast.dataset.styled = "true";
    toast.dataset.richColors = "true";
    toast.dataset.type = item.type || "default";
    toast.setAttribute("role", "status");
    if (item.icon) {
      const icon = document.createElement("span");
      icon.dataset.icon = "";
      const image = document.createElement("img");
      image.src = item.icon;
      image.alt = "";
      icon.append(image);
      toast.append(icon);
    }
    const copy = document.createElement("div");
    copy.dataset.content = "";
    if (item.title) {
      const title = document.createElement("p");
      title.dataset.title = "";
      title.style.margin = "0";
      title.textContent = item.title;
      copy.append(title);
    }
    if (item.description) {
      const description = document.createElement("p");
      description.dataset.description = "";
      description.style.margin = "0";
      description.textContent = item.description;
      copy.append(description);
    }
    toast.append(copy);
    host.append(toast);
  }
  return host.getBoundingClientRect().height;
}
</script>
</body>
</html>`;

// A native sibling view can be stacked above external pages in the same window.
export class ToastOverlayWindow {
  private view: WebContentsView | null = null;
  private ready: Promise<void> | null = null;
  private generation = 0;
  private listening = false;

  constructor(private parent: BrowserWindow) {}

  async show(payload: ToastOverlay) {
    const generation = ++this.generation;
    const view = this.ensure();
    await this.ready;
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    const width = Math.max(1, Math.round(payload.width)) + EDGE_PADDING * 2;
    view.setBounds({
      x: Math.round(payload.x) - EDGE_PADDING,
      y: Math.round(payload.y),
      width,
      height: 1,
    });
    const height: number = await view.webContents.executeJavaScript(
      `render(${JSON.stringify(payload)})`,
    );
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    const measuredHeight = Math.max(1, Math.ceil(height));
    view.setBounds({
      x: Math.round(payload.x) - EDGE_PADDING,
      y: Math.round(payload.y + payload.height - measuredHeight) - EDGE_PADDING,
      width,
      height: measuredHeight + EDGE_PADDING * 2,
    });
    // Re-adding an existing child moves it above the active external page.
    this.parent.contentView.addChildView(view);
    view.setVisible(true);
  }

  hide() {
    this.generation++;
    const view = this.view;
    this.view = null;
    this.ready = null;
    if (!view) return;
    if (!this.parent.isDestroyed()) this.parent.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private ensure() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
      },
    });
    view.setVisible(false);
    view.setBackgroundColor("#00000000");
    this.parent.contentView.addChildView(view);
    this.ready = view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(toastDocument)}`,
    );
    if (!this.listening) {
      this.listening = true;
      this.parent.once("closed", () => this.hide());
    }
    this.view = view;
    return view;
  }
}
