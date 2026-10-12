import { BrowserWindow, WebContentsView } from "electron";
export class AccountBrowserManager {
  private windows = new Map<string, BrowserWindow>();
  private views = new Map<string, WebContentsView>();
  get(id: string) {
    return this.views.get(id);
  }
  show(id: string) {
    this.windows.get(id)?.show();
  }
  async open(accountId: string, url: string): Promise<WebContentsView> {
    const existing = this.views.get(accountId);
    if (existing) {
      this.show(accountId);
      return existing;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(accountId)) throw new Error("Invalid account ID");
    const win = new BrowserWindow({ width: 900, height: 700, show: false });
    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:facebook-${accountId}`,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.contentView.addChildView(view);
    const resize = () => {
      const [width, height] = win.getContentSize();
      view.setBounds({ x: 0, y: 0, width, height });
    };
    resize();
    win.on("resize", resize);
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.windows.set(accountId, win);
    this.views.set(accountId, view);
    win.on("closed", () => {
      if (!view.webContents.isDestroyed()) view.webContents.close();
      this.windows.delete(accountId);
      this.views.delete(accountId);
    });
    await view.webContents.loadURL(url);
    return view;
  }
}
