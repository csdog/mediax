import { WebContentsView, type BrowserWindow } from "electron";
import type { TooltipOverlay } from "../../shared/models";

const tooltipDocument = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  p {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    font: 500 12px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif;
    white-space: nowrap;
  }
</style>
</head>
<body>
<p id="tip"></p>
<script>
function render(data) {
  const tip = document.getElementById("tip");
  tip.textContent = data.text || "";
  tip.style.background = data.background || "#0d0d0d";
  tip.style.color = data.color || "#fff";
  tip.style.borderRadius = data.radius || "12px";
}
</script>
</body>
</html>`;

// A native sibling view stacks above external pages, which otherwise cover HTML tooltips.
export class TooltipOverlayView {
  private view: WebContentsView | null = null;
  private ready: Promise<void> | null = null;
  private generation = 0;
  private listening = false;

  constructor(private parent: BrowserWindow) {}

  async show(payload: TooltipOverlay) {
    const generation = ++this.generation;
    const view = this.ensure();
    await this.ready;
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    view.setBounds({
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      width: Math.max(1, Math.round(payload.width)),
      height: Math.max(1, Math.round(payload.height)),
    });
    await view.webContents.executeJavaScript(`render(${JSON.stringify(payload)})`);
    if (
      generation !== this.generation ||
      view.webContents.isDestroyed() ||
      this.parent.isDestroyed()
    )
      return;
    this.parent.contentView.addChildView(view);
    view.setVisible(true);
  }

  hide() {
    this.generation++;
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return;
    view.setVisible(false);
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
      `data:text/html;charset=utf-8,${encodeURIComponent(tooltipDocument)}`,
    );
    if (!this.listening) {
      this.listening = true;
      this.parent.once("closed", () => this.hide());
    }
    this.view = view;
    return view;
  }
}
