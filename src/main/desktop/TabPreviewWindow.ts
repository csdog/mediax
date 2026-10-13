import { BrowserWindow, systemPreferences } from "electron";
import type { TabPreviewOverlay } from "../../shared/models";
import { slidePreviewRect, type PreviewRect } from "./preview-slide";

const previewDocument = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  body { font: 430 13px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif; color: #0d0d0d; }
  .card {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid rgb(13 13 13 / 5%);
    border-radius: 12px;
    overflow: hidden;
  }
  .copy { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .title { margin: 0; font-size: 14px; }
  .meta { margin: 0; font-size: 12px; color: #5d5d5d; }
  img { width: 100%; height: 170px; object-fit: cover; object-position: top; border-top: 1px solid rgb(13 13 13 / 5%); }
  .placeholder { flex: 1; min-height: 170px; background: #f3f3f3; }
</style>
</head>
<body>
<div class="card" id="card"></div>
<script>
function render(data) {
  const card = document.getElementById("card");
  card.setAttribute("aria-label", data.label || "页面预览");
  card.replaceChildren();
  const copy = document.createElement("div");
  copy.className = "copy";
  for (const [index, line] of (data.lines || []).entries()) {
    const paragraph = document.createElement("p");
    paragraph.className = index === 0 ? "title" : "meta";
    paragraph.textContent = line;
    copy.append(paragraph);
  }
  card.append(copy);
  if (data.image) {
    const image = document.createElement("img");
    image.alt = data.alt || "页面缩略图";
    image.src = data.image;
    card.append(image);
  } else if (data.placeholder) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    card.append(placeholder);
  }
}
</script>
</body>
</html>`;

const slideMs = 220;

// A child window stacks above the account WebContentsView. Switching previews slides this window.
export class TabPreviewWindow {
  private window: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;
  private generation = 0;
  private motion = 0;
  private shown: PreviewRect | null = null;
  private destination: PreviewRect | null = null;
  private sliding = false;
  private listening = false;

  constructor(private parent: BrowserWindow) {}

  async show(payload: TabPreviewOverlay) {
    const generation = ++this.generation;
    const win = this.ensure();
    await this.ready;
    if (generation !== this.generation || win.isDestroyed() || this.parent.isDestroyed()) return;
    const target = this.screenBounds(payload);
    const slide =
      win.isVisible() &&
      this.shown !== null &&
      Math.abs(this.shown.x - target.x) > 4 &&
      !systemPreferences.getAnimationSettings().prefersReducedMotion;
    this.move(win, target, slide);
    if (win.webContents.isDestroyed()) return;
    await win.webContents.executeJavaScript(`render(${JSON.stringify(payload)})`);
    if (generation !== this.generation || win.isDestroyed()) return;
    if (!win.isVisible()) win.showInactive();
  }

  hide() {
    this.generation++;
    this.motion++;
    this.shown = null;
    this.destination = null;
    this.sliding = false;
    const win = this.window;
    this.window = null;
    this.ready = null;
    if (win && !win.isDestroyed()) win.destroy();
  }

  private screenBounds(payload: TabPreviewOverlay): PreviewRect {
    const content = this.parent.getContentBounds();
    return {
      x: Math.round(content.x + payload.x),
      y: Math.round(content.y + payload.y),
      width: Math.max(1, Math.round(payload.width)),
      height: Math.max(1, Math.round(payload.height)),
    };
  }

  private move(win: BrowserWindow, target: PreviewRect, slide: boolean) {
    if (slide && this.shown) {
      const from = this.shown;
      const token = ++this.motion;
      this.sliding = true;
      this.destination = target;
      const started = Date.now();
      const step = () => {
        if (token !== this.motion || win.isDestroyed()) return;
        const goal = this.destination ?? target;
        const progress = Math.min(1, (Date.now() - started) / slideMs);
        const next = slidePreviewRect(from, goal, progress);
        win.setBounds(next);
        this.shown = progress >= 1 ? goal : next;
        if (progress >= 1) {
          this.sliding = false;
          this.destination = null;
          return;
        }
        setTimeout(step, 16);
      };
      step();
      return;
    }
    if (this.sliding && this.destination && Math.abs(this.destination.x - target.x) <= 4) {
      this.destination = target;
      return;
    }
    this.motion++;
    this.sliding = false;
    this.destination = null;
    win.setBounds(target);
    this.shown = target;
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
      focusable: false,
      skipTaskbar: true,
      show: false,
      roundedCorners: true,
      backgroundColor: "#00000000",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.setIgnoreMouseEvents(true);
    this.ready = win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(previewDocument)}`);
    if (!this.listening) {
      this.listening = true;
      this.parent.once("closed", () => this.hide());
    }
    this.window = win;
    return win;
  }
}
