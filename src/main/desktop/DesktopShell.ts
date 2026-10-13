import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";
import type { Database } from "../storage/Database";
import type { DesktopCommand, DesktopPage, ShortcutSettings } from "../../shared/models";
import {
  defaultShortcutMap,
  isValidAccelerator,
  mergeShortcutMap,
  normalizeAccelerator,
  shortcutEntry,
} from "../../shared/shortcutCatalog";
import { findDeepLinkArg, parseDeepLink } from "./deepLinks";
import { findOpenFileArgs, openFilesCommand } from "./openFiles";
import { tabShortcut } from "./tabShortcuts";
import { TaskDockStatus } from "./TaskDockStatus";
import { TaskNotifications } from "./TaskNotifications";
import { TaskPowerSave } from "./TaskPowerSave";
import { presentNotification } from "./presentNotification";
import { readNotificationSettings } from "../../shared/notificationSettings";
import { readDesktopBehavior } from "../../shared/desktopBehavior";

export class DesktopShell {
  private tray: Tray;
  private shortcuts = defaultShortcutMap();
  private globalRegistered = false;
  private globalError: string | undefined;
  private quitting = false;
  private rendererIsReady = false;
  private pending: DesktopCommand[] = [];
  private stateTimer?: ReturnType<typeof setTimeout>;
  private taskNotifications: TaskNotifications;
  private taskDockStatus: TaskDockStatus;
  private taskPowerSave: TaskPowerSave;
  constructor(
    private window: BrowserWindow,
    private db: Database,
  ) {
    const assets = app.isPackaged ? process.resourcesPath : join(__dirname, "../../build");
    const iconPath = join(assets, "icon.png");
    const source = nativeImage.createFromPath(iconPath);
    if (source.isEmpty()) throw new Error("菜单栏图标加载失败");
    this.tray = new Tray(menuBarIcon(source));
    this.tray.setToolTip("MediaX · 本地发布工具");
    this.tray.setContextMenu(Menu.buildFromTemplate(this.quickActions(true)));
    this.tray.on("double-click", () => this.show());
    if (process.platform === "darwin") {
      if (!app.isPackaged) app.dock?.setIcon(iconPath);
      app.dock?.setMenu(Menu.buildFromTemplate(this.quickActions(false)));
    }
    const attachShortcuts = (contents: Electron.WebContents) => {
      contents.on("before-input-event", (event, input) => {
        const operation = tabShortcut(input, this.shortcuts);
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
    this.shortcuts = this.loadShortcuts();
    this.installMenu();
    try {
      this.applyGlobalShortcut(this.shortcuts["global-show"] ?? "", false);
    } catch (error) {
      this.globalRegistered = false;
      this.globalError = error instanceof Error ? error.message : String(error);
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
    app.on("second-instance", (_event, argv) => {
      const link = findDeepLinkArg(argv);
      if (link) {
        this.handleDeepLink(link);
        return;
      }
      const files = findOpenFileArgs(argv);
      if (files.length) this.handleOpenFiles(files);
      else this.show();
    });
    app.on("before-quit", () => {
      this.quitting = true;
      this.saveWindowState();
      clearTimeout(this.stateTimer);
    });
    this.taskNotifications = new TaskNotifications(db, (notice) => {
      const prefs = readNotificationSettings((key) => this.db.setting(key));
      void presentNotification(this.window, {
        title: notice.title,
        body: notice.body,
        silent: !prefs.sound,
        onClick: () =>
          this.dispatch({ action: "navigate", page: "history", taskId: notice.taskId }),
      });
    });
    this.taskDockStatus = new TaskDockStatus(db, window);
    this.taskPowerSave = new TaskPowerSave(
      db,
      () => readDesktopBehavior((key) => this.db.setting(key)).keepAwakeWhilePublishing,
    );
    app.once("will-quit", () => {
      if (this.globalRegistered) {
        const current = normalizeAccelerator(this.shortcuts["global-show"] ?? "");
        if (current) globalShortcut.unregister(current);
      }
      this.taskNotifications.dispose();
      this.taskDockStatus.dispose();
      this.taskPowerSave.dispose();
      this.tray.destroy();
    });
  }
  syncPowerSave() {
    this.taskPowerSave.sync();
  }
  handleDeepLink(raw: string) {
    const command = parseDeepLink(raw);
    if (command) this.dispatch(command);
    else this.show();
  }
  handleOpenFiles(paths: string[]) {
    const command = openFilesCommand(paths);
    if (command) this.dispatch(command);
    else this.show();
  }
  shortcutSettings(): ShortcutSettings {
    return {
      accelerator: this.shortcuts["global-show"] ?? "",
      registered: this.globalRegistered,
      error: this.globalError,
      shortcuts: { ...this.shortcuts },
    };
  }
  setGlobalShortcut(accelerator: string, persist = true): ShortcutSettings {
    return this.setShortcut("global-show", accelerator, persist);
  }
  resetShortcuts(): ShortcutSettings {
    const previousGlobal = normalizeAccelerator(this.shortcuts["global-show"] ?? "");
    this.shortcuts = defaultShortcutMap();
    this.db.setSetting("keyboardShortcuts", this.shortcuts);
    this.db.setSetting("globalShortcut", this.shortcuts["global-show"]);
    this.installMenu();
    try {
      this.applyGlobalShortcut(this.shortcuts["global-show"] ?? "", false);
    } catch (error) {
      this.globalRegistered = false;
      this.globalError = error instanceof Error ? error.message : String(error);
      if (
        previousGlobal &&
        previousGlobal !== normalizeAccelerator(this.shortcuts["global-show"])
      ) {
        try {
          globalShortcut.unregister(previousGlobal);
        } catch {}
      }
    }
    return this.shortcutSettings();
  }
  setShortcut(id: string, accelerator: string, persist = true): ShortcutSettings {
    const entry = shortcutEntry(id);
    if (!entry) throw new Error("未知快捷键");
    const next = accelerator.trim();
    if (!isValidAccelerator(next)) throw new Error("请选择包含修饰键的有效快捷键");
    const normalizedNext = next ? normalizeAccelerator(next) : "";
    if (normalizedNext) {
      for (const [otherId, value] of Object.entries(this.shortcuts)) {
        if (otherId === id || !value) continue;
        if (normalizeAccelerator(value) === normalizedNext)
          throw new Error(`快捷键与「${shortcutEntry(otherId)?.title ?? otherId}」冲突`);
      }
    }
    if (entry.scope === "global") {
      this.applyGlobalShortcut(next, persist);
      this.shortcuts[id] = this.shortcuts["global-show"] ?? next;
    } else {
      this.shortcuts[id] = next;
      if (persist) {
        this.db.setSetting("keyboardShortcuts", this.shortcuts);
      }
      this.installMenu();
      this.globalError = undefined;
    }
    return this.shortcutSettings();
  }
  private loadShortcuts() {
    const saved = mergeShortcutMap(this.db.setting("keyboardShortcuts"));
    const legacy = this.db.setting("globalShortcut");
    if (
      typeof legacy === "string" &&
      legacy !== "CommandOrControl+Shift+Space" &&
      (!this.db.setting("keyboardShortcuts") ||
        saved["global-show"] === defaultShortcutMap()["global-show"])
    ) {
      saved["global-show"] = legacy;
    }
    return saved;
  }
  private applyGlobalShortcut(accelerator: string, persist: boolean) {
    const next = accelerator.trim() ? normalizeAccelerator(accelerator) : "";
    if (!isValidAccelerator(accelerator.trim())) throw new Error("请选择包含修饰键的有效快捷键");
    const previous = normalizeAccelerator(this.shortcuts["global-show"] ?? "");
    if (next === previous && this.globalRegistered) {
      this.globalError = undefined;
      return;
    }
    if (next) {
      let registered = false;
      try {
        registered = globalShortcut.register(next, () => this.show());
      } catch {}
      if (!registered) throw new Error("快捷键已被占用或系统不支持，请换一个组合");
    }
    try {
      this.shortcuts["global-show"] = accelerator.trim() ? next : "";
      if (persist) {
        this.db.setSetting("keyboardShortcuts", this.shortcuts);
        this.db.setSetting("globalShortcut", this.shortcuts["global-show"]);
      }
    } catch (error) {
      if (next) globalShortcut.unregister(next);
      throw error;
    }
    if (this.globalRegistered && previous && previous !== next) globalShortcut.unregister(previous);
    this.globalRegistered = Boolean(next);
    this.globalError = undefined;
  }
  private accel(id: string) {
    const value = this.shortcuts[id] ?? "";
    return value || undefined;
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
      this.window.webContents.send("mediax:command", command);
  }
  private dispatch(command: DesktopCommand) {
    this.show();
    if (this.rendererIsReady) this.window.webContents.send("mediax:command", command);
    else this.pending.push(command);
  }
  private navigate(page: DesktopPage) {
    this.dispatch({ action: "navigate", page });
  }
  private quickActions(includeQuit: boolean): Electron.MenuItemConstructorOptions[] {
    return [
      { label: "打开主窗口", click: () => this.show() },
      { label: "账号管理", click: () => this.navigate("accounts") },
      { label: "编辑内容", click: () => this.navigate("compose") },
      { label: "视频", click: () => this.navigate("video") },
      { label: "发布记录", click: () => this.navigate("history") },
      { type: "separator" },
      { label: "设置…", click: () => this.dispatch({ action: "settings" }) },
      ...(includeQuit
        ? [{ type: "separator" as const }, { label: "退出 MediaX", click: () => app.quit() }]
        : []),
    ];
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
                label: "MediaX",
                submenu: [
                  { role: "about" as const },
                  {
                    label: "设置…",
                    accelerator: this.accel("settings"),
                    click: () => this.dispatch({ action: "settings" as const }),
                  },
                  { type: "separator" as const },
                  { role: "services" as const },
                  { type: "separator" as const },
                  { role: "hide" as const },
                  { role: "hideOthers" as const },
                  { role: "unhide" as const },
                  { type: "separator" as const },
                  { role: "quit" as const, label: "退出 MediaX" },
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
              accelerator: this.accel("compose"),
              click: () => this.navigate("compose"),
            },
            {
              id: "desktop.import",
              label: "导入 Markdown…",
              accelerator: this.accel("import-markdown"),
              click: () => this.dispatch({ action: "import-markdown" }),
            },
            {
              id: "desktop.save",
              label: "保存草稿",
              accelerator: this.accel("save-draft"),
              click: () => this.dispatch({ action: "save-draft" }),
            },
            { type: "separator" },
            {
              id: "desktop.new-tab",
              label: "新建标签页",
              accelerator: this.accel("new-tab"),
              click: () => this.dispatch({ action: "tab", operation: "new" }),
            },
            {
              id: "desktop.close-tab",
              label: "关闭标签页",
              accelerator: this.accel("close-tab"),
              click: () => this.dispatch({ action: "tab", operation: "close" }),
            },
            {
              id: "desktop.reopen-tab",
              label: "重新打开关闭的标签页",
              accelerator: this.accel("reopen-tab"),
              click: () => this.dispatch({ action: "tab", operation: "reopen" }),
            },
            {
              label: "关闭窗口",
              accelerator: this.accel("hide-window"),
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
              accelerator: this.accel("accounts"),
              click: () => this.navigate("accounts"),
            },
            {
              id: "desktop.editor",
              label: "内容发布",
              accelerator: this.accel("compose-page"),
              click: () => this.navigate("compose"),
            },
            {
              id: "desktop.video",
              label: "视频",
              accelerator: this.accel("video"),
              click: () => this.navigate("video"),
            },
            {
              id: "desktop.history",
              label: "发布记录",
              accelerator: this.accel("history"),
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

function menuBarIcon(source: Electron.NativeImage) {
  const mac = process.platform === "darwin";
  const pixels = mac ? 44 : 32;
  const resized = source.resize({ width: pixels, height: pixels, quality: "best" });
  if (!mac) return resized;
  return nativeImage.createFromBuffer(resized.toPNG(), { scaleFactor: 2 });
}
