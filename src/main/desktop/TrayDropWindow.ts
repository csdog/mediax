import { BrowserWindow, ipcMain, screen, type Tray } from "electron";
import { join } from "node:path";

import { trayDropBounds } from "./trayDropBounds";

const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  body { font-family: -apple-system, "SF Pro Display", "PingFang SC", sans-serif; }
  #card {
    display: none;
    box-sizing: border-box;
    height: 100%;
    margin: 0;
    padding: 28px 32px 26px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.96);
    color: #0d0d0d;
    box-shadow:
      0 0 0 1px rgba(13, 13, 13, 0.08),
      0 24px 60px rgba(13, 13, 13, 0.18);
  }
  body.hot #card { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
  body.hot #card.over {
    box-shadow:
      0 0 0 2px #0285ff,
      0 28px 70px rgba(2, 133, 255, 0.22);
  }
  .mark { margin: 0; font-size: 13px; letter-spacing: 0.14em; font-weight: 600; color: #0285ff; }
  h1 { margin: 0; font-size: 32px; line-height: 1.15; font-weight: 650; letter-spacing: -0.03em; }
  p { margin: 0; font-size: 15px; line-height: 1.45; color: #5d5d5d; }
  @media (prefers-color-scheme: dark) {
    #card { background: rgba(28, 28, 28, 0.96); color: #f5f5f5; box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.45); }
    p { color: #b5b5b5; }
  }
</style>
</head>
<body>
  <section id="card">
    <p class="mark">MEDIAX</p>
    <h1 id="title">拖动到这里</h1>
    <p id="detail">松开文件，直接开始发布</p>
  </section>
  <script>
    const card = document.getElementById("card");
    const title = document.getElementById("title");
    const detail = document.getElementById("detail");
    let depth = 0;
    let hideTimer = 0;
    const arm = (event) => {
      clearTimeout(hideTimer);
      const count = event.dataTransfer ? event.dataTransfer.items.length : 0;
      title.textContent = count > 1 ? "把这些文件拖到这里" : "拖动到这里";
      detail.textContent = count > 1 ? "松开这 " + count + " 个文件，直接开始发布" : "松开文件，直接开始发布";
      document.body.classList.add("hot");
      card.classList.toggle("over", depth > 0);
      window.trayDrop.setHot(true);
    };
    const disarm = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        depth = 0;
        document.body.classList.remove("hot");
        card.classList.remove("over");
        window.trayDrop.setHot(false);
      }, 160);
    };
    document.addEventListener("dragenter", (event) => {
      event.preventDefault();
      depth += 1;
      arm(event);
    });
    document.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      arm(event);
    });
    document.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) disarm();
    });
    document.addEventListener("drop", (event) => {
      event.preventDefault();
      depth = 0;
      clearTimeout(hideTimer);
      const paths = [...event.dataTransfer.files]
        .map((file) => window.trayDrop.pathForFile(file))
        .filter(Boolean);
      document.body.classList.remove("hot");
      card.classList.remove("over");
      window.trayDrop.setHot(false);
      window.trayDrop.dropped(paths);
    });
  </script>
</body>
</html>`;

/** Drop lane under the tray icon. Dragging files in shows a large “拖动到这里” card. */
export class TrayDropWindow {
  private window: BrowserWindow | null = null;
  private hot = false;
  private readonly onHot = (event: Electron.IpcMainEvent, hot: unknown) => {
    if (!this.window || event.sender !== this.window.webContents) return;
    this.setHot(hot === true);
  };
  private readonly onFiles = (event: Electron.IpcMainEvent, paths: unknown) => {
    if (!this.window || event.sender !== this.window.webContents) return;
    this.setHot(false);
    const list = Array.isArray(paths)
      ? paths.filter((item): item is string => typeof item === "string")
      : [];
    if (list.length) this.onDrop(list);
  };

  constructor(
    private tray: Tray,
    private onDrop: (paths: string[]) => void,
  ) {
    this.window = new BrowserWindow({
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      alwaysOnTop: true,
      roundedCorners: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        preload: join(__dirname, "../preload/index.js"),
      },
    });
    // Electron otherwise hides the entire app's Dock icon for fullscreen overlays.
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
    this.window.setAlwaysOnTop(true, "pop-up-menu");
    ipcMain.on("mediax:tray-drop-hot", this.onHot);
    ipcMain.on("mediax:tray-drop-files", this.onFiles);
    void this.window
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
      .then(() => {
        this.place();
        this.window?.showInactive();
      });
    screen.on("display-metrics-changed", this.place);
  }

  private place = () => {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    const tray = this.tray.getBounds();
    if (tray.width <= 0 || tray.height <= 0) return;
    const display = screen.getDisplayMatching(tray);
    win.setBounds(trayDropBounds(tray, display.workArea, this.hot));
    win.setHasShadow(this.hot);
  };

  private setHot(hot: boolean) {
    if (this.hot === hot) return;
    this.hot = hot;
    if (process.platform === "darwin") this.tray.setTitle(hot ? " 拖动到这里" : "");
    this.place();
  }

  dispose() {
    ipcMain.removeListener("mediax:tray-drop-hot", this.onHot);
    ipcMain.removeListener("mediax:tray-drop-files", this.onFiles);
    screen.removeListener("display-metrics-changed", this.place);
    if (process.platform === "darwin") this.tray.setTitle("");
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
  }
}
