import { BrowserWindow, WebContentsView } from "electron";
import { CdpBridge } from "./CdpBridge";
import type { BrowserBounds } from "../../shared/models";
export class AccountBrowserManager {
  private windows = new Map<string, BrowserWindow>();
  private views = new Map<string, WebContentsView>();
  private activeId: string | null = null;
  private bounds?: BrowserBounds;
  private bridge = new CdpBridge();
  private connected = false;
  constructor(
    private host?: BrowserWindow,
    private endpoint?: string,
  ) {
    if (!host) return;
    host.on("resize", () => this.layout());
    host.webContents.on("did-start-navigation", (_event, _url, _inPlace, mainFrame) => {
      if (mainFrame) this.setLayout(null);
    });
    host.on("closed", () => {
      for (const id of this.views.keys()) this.close(id);
    });
  }
  async page(id: string) {
    const view = this.views.get(id);
    if (!view || view.webContents.isDestroyed()) throw new Error("请先打开账号标签页");
    if (!this.endpoint) throw new Error("未配置本地浏览器连接");
    if (!this.connected) {
      await this.bridge.connect(this.endpoint);
      this.connected = true;
    }
    const debug = view.webContents.debugger;
    if (debug.isAttached()) throw new Error("请先关闭账号页面开发者工具");
    debug.attach("1.3");
    let targetId: string;
    try {
      targetId = (await debug.sendCommand("Target.getTargetInfo")).targetInfo.targetId;
    } finally {
      debug.detach();
    }
    try {
      return await this.bridge.findTarget(targetId);
    } catch {
      await this.bridge.disconnect();
      await this.bridge.connect(this.endpoint);
      return this.bridge.findTarget(targetId);
    }
  }
  get(id: string) {
    return this.views.get(id);
  }
  show(id: string) {
    if (this.host) {
      if (this.host.isMinimized()) this.host.restore();
      this.host.show();
      this.host.focus();
    } else this.windows.get(id)?.show();
  }
  setLayout(id: string | null, bounds?: BrowserBounds) {
    this.activeId = id;
    this.bounds = bounds;
    this.layout();
  }
  private layout() {
    if (!this.host || this.host.isDestroyed()) return;
    const [width, height] = this.host.getContentSize();
    for (const [id, view] of this.views) {
      const visible = id === this.activeId && Boolean(this.bounds);
      view.setVisible(visible);
      if (!visible || !this.bounds) continue;
      const x = Math.max(0, Math.min(width, Math.round(this.bounds.x)));
      const y = Math.max(44, Math.min(height, Math.round(this.bounds.y)));
      view.setBounds({
        x,
        y,
        width: Math.max(0, Math.min(width - x, Math.round(this.bounds.width))),
        height: Math.max(0, Math.min(height - y, Math.round(this.bounds.height))),
      });
    }
  }
  close(id: string) {
    const view = this.views.get(id);
    if (!view) return;
    if (this.host && !this.host.isDestroyed()) this.host.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    this.views.delete(id);
    const win = this.windows.get(id);
    this.windows.delete(id);
    if (win && !win.isDestroyed()) win.destroy();
    if (this.activeId === id) this.activeId = null;
  }
  async open(accountId: string, url: string): Promise<WebContentsView> {
    const existing = this.views.get(accountId);
    if (existing) {
      this.show(accountId);
      return existing;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(accountId)) throw new Error("Invalid account ID");
    // Standalone windows are retained only for the isolated CDP fixture.
    const win = this.host ?? new BrowserWindow({ width: 900, height: 700, show: false });
    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:facebook-${accountId}`,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    view.setBounds({ x: 0, y: 44, width: 1000, height: 700 });
    view.setVisible(!this.host);
    win.contentView.addChildView(view);
    this.views.set(accountId, view);
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    if (this.host) this.layout();
    else {
      const resize = () => {
        const [width, height] = win.getContentSize();
        view.setBounds({ x: 0, y: 0, width, height });
      };
      resize();
      win.on("resize", resize);
      this.windows.set(accountId, win);
      win.on("closed", () => this.close(accountId));
    }
    await view.webContents.loadURL(url);
    return view;
  }
}
