import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";
import { join } from "node:path";
import type { Database } from "../storage/Database";
import type { DesktopCommand, DesktopPage, ShortcutSettings } from "../../shared/models";
import { tabShortcut } from "./tabShortcuts";
import { TaskNotifications } from "./TaskNotifications";

export class DesktopShell {
  private tray: Tray;
  private shortcut: ShortcutSettings = { accelerator: "", registered: false };
  private quitting = false;
  private rendererIsReady = false;
  private pending: DesktopCommand[] = [];
  private stateTimer?: ReturnType<typeof setTimeout>;
  private notifications = new Set<Notification>();
  private taskNotifications: TaskNotifications;
  constructor(
    private window: BrowserWindow,
    private db: Database,
  ) {
    const assets = app.isPackaged ? process.resourcesPath : join(__dirname, "../../build");
    const trayImage = nativeImage.createFromPath(join(assets, "trayTemplate.png"));
    if (trayImage.isEmpty()) throw new Error("菜单栏图标加载失败");
    trayImage.setTemplateImage(true);
    this.tray = new Tray(trayImage);
    this.tray.setToolTip("media-post · 本地发布工具");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "打开主窗口", click: () => this.show() },
        { label: "编辑内容", click: () => this.navigate("compose") },
        { label: "发布记录", click: () => this.navigate("history") },
        { type: "separator" },
        { label: "退出 media-post", click: () => app.quit() },
      ]),
    );
    this.tray.on("double-click", () => this.show());
    if (process.platform === "darwin" && !app.isPackaged)
      app.dock?.setIcon(join(assets, "icon.png"));
    const attachShortcuts = (contents: Electron.WebContents) => {
      contents.on("before-input-event", (event, input) => {
        const operation = tabShortcut(input);
        if (!operation || !this.window.isFocused()) return;
        event.preventDefault();
        this.dispatch(
          operation === "settings" ? { action: "settings" } : { action: "tab", operation },
        );
      });
    };
    attachShortcuts(window.webContents);
    // Native account views receive input outside the React renderer.
    app.on("web-contents-created", (_event, contents) => attachShortcuts(contents));
    this.installMenu();
    const savedShortcut = db.setting("globalShortcut");
    const accelerator =
      typeof savedShortcut === "string" && savedShortcut !== "CommandOrControl+Shift+Space"
        ? savedShortcut
        : "CommandOrControl+M";
    try {
      this.setGlobalShortcut(accelerator, false);
    } catch (error) {
      this.shortcut = {
        accelerator,
        registered: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    window.webContents.on("did-start-navigation", (_event, _url, _inPlace, mainFrame) => {
      if (mainFrame) this.rendererIsReady = false;
    });
    window.on("close", (event) => {
      this.saveWindowState();
      if (!this.quitting) {
        event.preventDefault();
        window.hide();
      }
    });
    const scheduleStateSave = () => {
      clearTimeout(this.stateTimer);
      this.stateTimer = setTimeout(() => this.saveWindowState(), 200);
    };
    window.on("move", scheduleStateSave);
    window.on("resize", scheduleStateSave);
    window.on("maximize", scheduleStateSave);
    window.on("unmaximize", scheduleStateSave);
    app.on("activate", () => this.show());
    app.on("second-instance", () => this.show());
    app.on("before-quit", (event) => {
      const active = db
        .targets()
        .filter((t) => ["pending", "running", "awaiting_user", "submitted"].includes(t.status));
      if (!this.quitting && active.length) {
        const answer = dialog.showMessageBoxSync(window, {
          type: "question",
          title: "退出 media-post",
          message: "仍有未完成或待核验的发布任务",
          detail:
            "退出会停止本机任务。再次启动后，请先检查发布记录，避免重复发布。关闭窗口可以继续在后台运行。",
          buttons: ["取消", "退出"],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer === 0) {
          event.preventDefault();
          return;
        }
      }
      this.quitting = true;
      this.saveWindowState();
      clearTimeout(this.stateTimer);
    });
    this.taskNotifications = new TaskNotifications(db, (notice) => {
      if (!Notification.isSupported()) return;
      const notification = new Notification({ title: notice.title, body: notice.body });
      this.notifications.add(notification);
      notification.on("click", () =>
        this.dispatch({ action: "navigate", page: "history", taskId: notice.taskId }),
      );
      notification.on("close", () => this.notifications.delete(notification));
      notification.on("failed", (_event, error) => {
        console.warn("系统通知未送达:", error);
        this.notifications.delete(notification);
      });
      notification.show();
    });
    app.once("will-quit", () => {
      if (this.shortcut.registered) globalShortcut.unregister(this.shortcut.accelerator);
      this.taskNotifications.dispose();
      for (const n of this.notifications) n.close();
      this.tray.destroy();
    });
  }
  shortcutSettings(): ShortcutSettings {
    return { ...this.shortcut };
  }
  setGlobalShortcut(accelerator: string, persist = true): ShortcutSettings {
    const next = accelerator
      .trim()
      .replace(
        /CommandOrControl|CmdOrCtrl/g,
        process.platform === "darwin" ? "Command" : "Control",
      );
    if (
      next.length > 100 ||
      (next &&
        !/(?:^|\+)(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|Super|Meta)\+/.test(
          next,
        )) ||
      (next &&
        !/^(?:(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|Shift|Super|Meta)\+)+[A-Za-z0-9]+$/.test(
          next,
        ))
    )
      throw new Error("请选择包含修饰键的有效快捷键");
    if (next === this.shortcut.accelerator && this.shortcut.registered)
      return this.shortcutSettings();
    if (next) {
      let registered = false;
      try {
        registered = globalShortcut.register(next, () => this.show());
      } catch {}
      if (!registered) throw new Error("快捷键已被占用或系统不支持，请换一个组合");
    }
    try {
      if (persist) this.db.setSetting("globalShortcut", next);
    } catch (error) {
      if (next) globalShortcut.unregister(next);
      throw error;
    }
    if (this.shortcut.registered) globalShortcut.unregister(this.shortcut.accelerator);
    this.shortcut = { accelerator: next, registered: Boolean(next) };
    return this.shortcutSettings();
  }
  show() {
    if (this.window.isDestroyed()) return;
    if (this.window.isMinimized()) this.window.restore();
    this.window.show();
    this.window.focus();
  }
  rendererReady() {
    this.rendererIsReady = true;
    for (const command of this.pending.splice(0))
      this.window.webContents.send("media-post:command", command);
  }
  private dispatch(command: DesktopCommand) {
    this.show();
    if (this.rendererIsReady) this.window.webContents.send("media-post:command", command);
    else this.pending.push(command);
  }
  private navigate(page: DesktopPage) {
    this.dispatch({ action: "navigate", page });
  }
  private saveWindowState() {
    if (this.window.isDestroyed() || this.window.isMinimized() || this.window.isFullScreen())
      return;
    this.db.setSetting("mainWindow", {
      ...this.window.getNormalBounds(),
      maximized: this.window.isMaximized(),
    });
  }
  private installMenu() {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        ...(process.platform === "darwin"
          ? [
              {
                label: "media-post",
                submenu: [
                  { role: "about" as const },
                  {
                    label: "设置…",
                    accelerator: "CmdOrCtrl+,",
                    click: () => this.dispatch({ action: "settings" as const }),
                  },
                  { type: "separator" as const },
                  { role: "services" as const },
                  { type: "separator" as const },
                  { role: "hide" as const },
                  { role: "hideOthers" as const },
                  { role: "unhide" as const },
                  { type: "separator" as const },
                  { role: "quit" as const, label: "退出 media-post" },
                ],
              },
            ]
          : []),
        {
          label: "文件",
          submenu: [
            {
              id: "desktop.compose",
              label: "编辑内容",
              accelerator: "CmdOrCtrl+N",
              click: () => this.navigate("compose"),
            },
            {
              id: "desktop.import",
              label: "导入 Markdown…",
              accelerator: "CmdOrCtrl+O",
              click: () => this.dispatch({ action: "import-markdown" }),
            },
            {
              id: "desktop.save",
              label: "保存草稿",
              accelerator: "CmdOrCtrl+S",
              click: () => this.dispatch({ action: "save-draft" }),
            },
            { type: "separator" },
            {
              id: "desktop.new-tab",
              label: "新建标签页",
              accelerator: "CmdOrCtrl+T",
              click: () => this.dispatch({ action: "tab", operation: "new" }),
            },
            {
              id: "desktop.close-tab",
              label: "关闭标签页",
              accelerator: "CmdOrCtrl+W",
              click: () => this.dispatch({ action: "tab", operation: "close" }),
            },
            {
              id: "desktop.reopen-tab",
              label: "重新打开关闭的标签页",
              accelerator: "CmdOrCtrl+Shift+T",
              click: () => this.dispatch({ action: "tab", operation: "reopen" }),
            },
            {
              label: "关闭窗口",
              accelerator: "CmdOrCtrl+Shift+W",
              click: () => this.window.close(),
            },
          ],
        },
        {
          label: "编辑",
          submenu: [
            { role: "undo", label: "撤销" },
            { role: "redo", label: "重做" },
            { type: "separator" },
            { role: "cut", label: "剪切" },
            { role: "copy", label: "复制" },
            { role: "paste", label: "粘贴" },
            { role: "selectAll", label: "全选" },
          ],
        },
        {
          label: "视图",
          submenu: [
            {
              id: "desktop.accounts",
              label: "账号管理",
              accelerator: "CmdOrCtrl+1",
              click: () => this.navigate("accounts"),
            },
            {
              id: "desktop.editor",
              label: "内容发布",
              accelerator: "CmdOrCtrl+2",
              click: () => this.navigate("compose"),
            },
            {
              id: "desktop.history",
              label: "发布记录",
              accelerator: "CmdOrCtrl+3",
              click: () => this.navigate("history"),
            },
            { type: "separator" },
            { role: "togglefullscreen", label: "切换全屏" },
            ...(!app.isPackaged
              ? [
                  { role: "reload" as const, label: "重新加载" },
                  { role: "toggleDevTools" as const, label: "开发者工具" },
                ]
              : []),
          ],
        },
        {
          label: "窗口",
          submenu: [
            { id: "desktop.show", label: "打开主窗口", click: () => this.show() },
            { role: "minimize", label: "最小化", accelerator: "CmdOrCtrl+Alt+M" },
            { role: "zoom", label: "缩放窗口" },
            ...(process.platform === "darwin"
              ? [{ role: "front" as const, label: "全部置于前面" }]
              : []),
          ],
        },
      ]),
    );
  }
}
