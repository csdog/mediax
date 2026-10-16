import {
  ipcMain,
  dialog,
  BrowserWindow,
  app,
  clipboard,
  nativeImage,
  shell as electronShell,
} from "electron";
import { readAccountGroups, createAccountGroup, setAccountGroups } from "./accounts/groups";
import { log } from "./logging";
import { readFile, stat } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import { postUrl } from "./platforms/facebook/FacebookAdapter";
import { PublishService } from "./publish/PublishService";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { markdownToText } from "./content/markdown";
import { coverDataUrl } from "./content/cover";
import { isAudio, isImage, isVideo } from "../shared/content";
import { mediaImportHost } from "./content/mediaImportHost";
import {
  isPlatform,
  type ContentKind,
  type ImageAsset,
  type TabPreviewOverlay,
  type ToastOverlay,
  type Target,
} from "../shared/models";
import { parseProfile, readProfile } from "../shared/profile";
import {
  mergePublishSettings,
  readPublishSettings,
  type PublishSettings,
} from "../shared/publishSettings";
import {
  mergeNotificationSettings,
  readNotificationSettings,
  type NotificationSettings,
} from "../shared/notificationSettings";
import {
  mergeDesktopBehavior,
  readDesktopBehavior,
  type DesktopBehavior,
} from "../shared/desktopBehavior";
import { readAutoUpdateEnabled } from "../shared/autoUpdateSettings";
import type { DesktopShell } from "./desktop/DesktopShell";
import type { DownloadStore } from "./desktop/DownloadStore";
import type { BrowserHistoryStore } from "./browser/BrowserHistoryStore";
import type { AppUpdater } from "./desktop/AppUpdater";
import { TabPreviewWindow } from "./desktop/TabPreviewWindow";
import { ToastOverlayWindow } from "./desktop/ToastOverlayWindow";
import {
  NativePopupWindow,
  parseNativePopup,
  parseNativePopupAction,
} from "./desktop/NativePopupWindow";
import {
  buildDiagnosticReport,
  exportDiagnosticReport,
  notificationPermissionStatus,
  openNotificationSettings,
  revealLogFile,
  sendTestNotification,
} from "./desktop/diagnostics";
import { clearStorageCategory, collectStorageUsage } from "./desktop/storageUsage";
import { isStorageCleanupId, storageCleanupActions } from "../shared/storageUsage";
import { readThemePreference, saveThemePreference } from "./desktop/themePreference";
import { systemSearchProvider, systemSearchUrl } from "./desktop/webSearch";
import { resolveOmniboxUrl } from "../shared/omnibox";
import { parseThemePreference } from "../shared/themePreference";
import { getOpenAtLogin, setOpenAtLogin } from "./desktop/loginItem";

function savePublishSettings(
  db: Database,
  accounts: AccountService,
  patch: Partial<PublishSettings>,
) {
  const next = mergePublishSettings(
    readPublishSettings((key) => db.setting(key)),
    patch,
  );
  db.setSetting("silentPublish", next.silent);
  db.setSetting("publishConcurrency", next.concurrency);
  db.setSetting("publishBandwidthLimitKbps", next.bandwidthLimitKbps);
  accounts.applyBandwidthLimit(next.bandwidthLimitKbps);
  return next;
}

export function registerIpc(
  db: Database,
  accounts: AccountService,
  window: BrowserWindow,
  rendererReady: () => void,
  shell: DesktopShell,
  updater: AppUpdater,
  downloads: DownloadStore,
  browserHistory: BrowserHistoryStore,
) {
  const stopLogging = db.onTargetChange((target) => {
    const write = ["failed", "unknown", "awaiting_user"].includes(target.status)
      ? log.warn
      : log.info;
    write("Publish target state changed", {
      taskId: target.taskId,
      targetId: target.id,
      status: target.status,
    });
  });
  app.once("will-quit", stopLogging);
  const images = new Map<string, ImageAsset>();
  const tabPreview = new TabPreviewWindow(window);
  const toastOverlay = new ToastOverlayWindow(window);
  const nativePopup = new NativePopupWindow(window, (event) => {
    if (!window.isDestroyed()) window.webContents.send("mediax:native-popup-event", event);
  });
  accounts.setBrowserPageInteraction(() => nativePopup.hide(true));
  const publishing = new PublishService(db, accounts, join(app.getPath("userData"), "task-assets"));
  publishing.startScheduler();
  app.once("will-quit", () => publishing.stopScheduler());
  const text = (value: unknown) => {
    if (typeof value !== "string") throw new Error("无效文本");
    return value;
  };
  const on = (name: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(`mediax:${name}`, async (event, ...args) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        log.warn("Rejected IPC call", { method: name });
        throw new Error("拒绝非应用页面调用");
      }
      log.debug("IPC call", { method: name });
      try {
        return await fn(...args);
      } catch (error) {
        // Do not log arguments, post bodies, image previews, cookies or passwords.
        log.warn("IPC call failed", {
          method: name,
          error: error instanceof Error ? error.message.split("\n")[0] : "Unknown error",
        });
        throw error;
      }
    });
  on("rendererReady", rendererReady);
  on("workspaceSession", () => db.setting("workspaceSession") ?? null);
  on("saveWorkspaceSession", (value) => {
    if (
      !value ||
      !Array.isArray(value.tabs) ||
      value.tabs.length > 100 ||
      !["accounts", "publish", "compose", "video", "history", "calendar", "analytics"].includes(
        value.page,
      )
    )
      throw new Error("无效标签页状态");
    const accountIds = new Set(db.accounts().map((account) => account.id));
    const ids = new Set<string>();
    const tabs = value.tabs.map(
      (tab: { id: string; kind?: string; contentKind?: unknown; url?: unknown }) => {
        if (!tab || typeof tab.id !== "string" || ids.has(tab.id)) throw new Error("无效标签页");
        if (tab.kind === "new") {
          if (!/^new-[a-zA-Z0-9-]{1,80}$/.test(tab.id)) throw new Error("无效标签页");
          ids.add(tab.id);
          return { id: tab.id, kind: "new" as const };
        }
        if (tab.kind === "compose") {
          if (!/^compose-[a-zA-Z0-9-]{1,80}$/.test(tab.id) || !isContentKind(tab.contentKind))
            throw new Error("无效标签页");
          ids.add(tab.id);
          return { id: tab.id, kind: "compose" as const, contentKind: tab.contentKind };
        }
        if (tab.kind === "web") {
          if (
            !/^web-[a-zA-Z0-9-]{1,80}$/.test(tab.id) ||
            typeof tab.url !== "string" ||
            !/^https?:\/\//i.test(tab.url.trim())
          )
            throw new Error("无效标签页");
          ids.add(tab.id);
          return { id: tab.id, kind: "web" as const, url: tab.url.trim() };
        }
        if (tab.kind !== undefined || !accountIds.has(tab.id)) throw new Error("无效标签页");
        ids.add(tab.id);
        return { id: tab.id };
      },
    );
    if (value.activeId !== null && !ids.has(value.activeId)) throw new Error("无效活动标签页");
    db.setSetting("workspaceSession", { tabs, activeId: value.activeId, page: value.page });
  });
  on("shortcutSettings", () => shell.shortcutSettings());
  on("setGlobalShortcut", (accelerator) => shell.setGlobalShortcut(text(accelerator)));
  on("setShortcut", (id, accelerator) => shell.setShortcut(text(id), text(accelerator)));
  on("resetShortcuts", () => shell.resetShortcuts());
  on("updateStatus", () => updater.getStatus());
  on("checkForUpdates", () => updater.check(true));
  on("installUpdate", () => updater.install());
  on("publishSettings", () => readPublishSettings((key) => db.setting(key)));
  on("setSilentPublish", (silent) => {
    if (typeof silent !== "boolean") throw new Error("无效设置");
    return savePublishSettings(db, accounts, { silent });
  });
  on("setPublishSettings", (value) => {
    if (!value || typeof value !== "object") throw new Error("无效设置");
    return savePublishSettings(db, accounts, value as Partial<PublishSettings>);
  });
  on("profileSettings", () => readProfile(db.setting("profile")));
  on("setProfile", (value) => {
    const profile = parseProfile(value);
    db.setSetting("profile", profile);
    return profile;
  });
  on("notificationSettings", () => readNotificationSettings((key) => db.setting(key)));
  on("setNotificationSettings", (value) => {
    if (!value || typeof value !== "object") throw new Error("无效通知设置");
    const next = mergeNotificationSettings(
      readNotificationSettings((key) => db.setting(key)),
      value as Partial<NotificationSettings>,
    );
    db.setSetting("notificationsEnabled", next.enabled);
    db.setSetting("notifyPublishResult", next.publishResult);
    db.setSetting("notifyAwaitingUser", next.awaitingUser);
    db.setSetting("notificationPrivacy", next.privacy);
    db.setSetting("notificationSound", next.sound);
    return next;
  });
  on("notificationPermission", () => notificationPermissionStatus());
  on("openNotificationSettings", () => openNotificationSettings());
  on("testNotification", () => sendTestNotification(window, (key) => db.setting(key)));
  on("themePreference", () => readThemePreference((key) => db.setting(key)));
  on("setThemePreference", (value) => {
    const next = parseThemePreference(value);
    if (value !== next) throw new Error("无效主题设置");
    return saveThemePreference((key, stored) => db.setSetting(key, stored), next);
  });
  on("desktopBehavior", () => readDesktopBehavior((key) => db.setting(key)));
  on("setDesktopBehavior", (value) => {
    if (!value || typeof value !== "object") throw new Error("无效桌面行为设置");
    const next = mergeDesktopBehavior(
      readDesktopBehavior((key) => db.setting(key)),
      value as Partial<DesktopBehavior>,
    );
    db.setSetting("keepAwakeWhilePublishing", next.keepAwakeWhilePublishing);
    db.setSetting("calendarTimezone", next.calendarTimezone);
    shell.syncPowerSave();
    return next;
  });
  on("autoUpdateEnabled", () => readAutoUpdateEnabled((key) => db.setting(key)));
  on("setAutoUpdateEnabled", (value) => {
    if (typeof value !== "boolean") throw new Error("无效自动更新设置");
    return updater.setAutoUpdateEnabled(value);
  });
  on("diagnostics", () => buildDiagnosticReport(db));
  on("storageUsage", (force?: boolean) => collectStorageUsage(force === true));
  on("clearStorage", async (id?: unknown) => {
    if (!isStorageCleanupId(id)) throw new Error("无效清理类型");
    const action = storageCleanupActions.find((item) => item.id === id);
    if (!action) throw new Error("无效清理类型");
    const iconPath = join(
      app.isPackaged ? process.resourcesPath : join(__dirname, "../../build"),
      "icon.png",
    );
    const icon = nativeImage.createFromPath(iconPath);
    const { response } = await dialog.showMessageBox(window, {
      type: action.dangerous ? "warning" : "question",
      buttons: ["取消", action.button],
      defaultId: action.dangerous ? 0 : 1,
      cancelId: 0,
      title: action.title,
      message: action.title,
      detail: action.confirm,
      ...(icon.isEmpty() ? {} : { icon }),
    });
    if (response !== 1) return null;
    if (id === "assets") {
      const busy = db
        .targets()
        .some((target) => ["pending", "running", "awaiting_user"].includes(target.status));
      if (busy) throw new Error("有发布任务进行中，请稍后再清理素材");
    }
    if (id === "sessions")
      return clearStorageCategory(id, () => accounts.clearAllBrowserSessions());
    return clearStorageCategory(id);
  });
  on("exportDiagnostics", () => exportDiagnosticReport(window, db));
  on("revealLogFile", () => revealLogFile());
  on("openAtLogin", () => getOpenAtLogin());
  on("setOpenAtLogin", (value) => {
    if (typeof value !== "boolean") throw new Error("无效登录项设置");
    return setOpenAtLogin(value);
  });
  on("chooseAvatar", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = result.filePaths[0];
    const info = await stat(file);
    if (info.size > 10 * 1024 * 1024) throw new Error("头像图片需要小于 10MB");
    const image = nativeImage.createFromPath(file);
    if (image.isEmpty()) throw new Error("无法读取这张图片");
    const { width, height } = image.getSize();
    const edge = Math.min(width, height);
    const square = image.crop({
      x: Math.round((width - edge) / 2),
      y: Math.round((height - edge) / 2),
      width: edge,
      height: edge,
    });
    const dataUrl = square.resize({ width: 256, height: 256, quality: "best" }).toDataURL();
    if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("无法读取这张图片");
    return dataUrl;
  });
  on("accountGroups", () => readAccountGroups(db));
  on("setAccountGroups", (id, groupIds) => setAccountGroups(db, id, groupIds));
  on("createAccountGroup", (input) => createAccountGroup(db, input));
  on("accounts", () => accounts.list());
  on("addAccount", (name, platform) => {
    if (!isPlatform(platform)) throw new Error("暂不支持该平台");
    return accounts.add(text(name), platform);
  });
  on("previewAccountBrowser", (id) => accounts.preview(text(id)));
  on("openAccount", (id, url) =>
    accounts.open(text(id), typeof url === "string" && url.trim() ? url.trim() : undefined),
  );
  on("openWebBrowser", (id, url) => accounts.openWeb(text(id), text(url)));
  on("resolveOmniboxUrl", (input) => resolveOmniboxUrl(text(input), systemSearchUrl));
  on("webSearchProvider", () => systemSearchProvider());
  on("browserNavigation", (id) => accounts.browserNavigation(text(id)));
  on("browserHistory", (query) => browserHistory.search(typeof query === "string" ? query : ""));
  on("removeBrowserHistory", (url) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) throw new Error("无效网址");
    browserHistory.remove(url.trim());
  });
  on("navigateBrowser", (id, url) => accounts.navigateBrowser(text(id), text(url)));
  on("goBackBrowser", (id) => accounts.goBackBrowser(text(id)));
  on("goForwardBrowser", (id) => accounts.goForwardBrowser(text(id)));
  on("reloadBrowser", (id) => accounts.reloadBrowser(text(id)));
  on("browserZoom", (id) => accounts.browserZoom(text(id)));
  on("setBrowserZoom", (id, factor) => {
    if (typeof factor !== "number" || !Number.isFinite(factor)) throw new Error("无效缩放");
    return accounts.setBrowserZoom(text(id), factor);
  });
  on("printBrowser", (id) => accounts.printBrowser(text(id)));
  on("findInBrowser", (id, query, options) =>
    accounts.findInBrowser(
      text(id),
      text(query),
      options && typeof options === "object"
        ? {
            forward: (options as { forward?: boolean }).forward,
            findNext: (options as { findNext?: boolean }).findNext,
          }
        : undefined,
    ),
  );
  on("stopFindInBrowser", (id) => accounts.stopFindInBrowser(text(id)));
  on("screenshotBrowser", (id) => accounts.screenshotBrowser(text(id)));
  on("clearBrowserData", (id) => accounts.clearBrowserData(text(id)));
  on("layoutAccountBrowser", (id, bounds) => {
    if (id === null) return accounts.layout(null);
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ||
      bounds.width < 0 ||
      bounds.height < 0
    )
      throw new Error("无效浏览器区域");
    return accounts.layout(text(id), {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  });
  on("closeAccountBrowser", (id) => accounts.close(text(id)));
  on("showTabPreview", (value) => tabPreview.show(previewOverlay(value)));
  on("hideTabPreview", () => tabPreview.hide());
  on("showToastOverlay", (value) =>
    toastOverlay.show(toastOverlayPayload(value, window.getContentSize()[0])),
  );
  on("hideToastOverlay", () => toastOverlay.hide());
  const fromMainRenderer = (sender: Electron.WebContents) =>
    sender === window.webContents && !window.isDestroyed();
  ipcMain.on("mediax:native-popup-host-show", (event, value) => {
    if (!fromMainRenderer(event.sender)) return;
    try {
      nativePopup.show(parseNativePopup(value));
    } catch (error) {
      log.warn("Native popup show failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  ipcMain.on("mediax:native-popup-host-hide", (event) => {
    if (!fromMainRenderer(event.sender)) return;
    nativePopup.hide();
  });
  ipcMain.on("mediax:native-popup-notify", (event, value) => {
    if (!nativePopup.owns(event.sender)) return;
    if (!value || typeof value !== "object") return;
    if (value.type === "resize" && typeof value.height === "number") {
      nativePopup.resize(value.height);
      return;
    }
    if (value.type === "action") {
      const action = parseNativePopupAction(value.action);
      if (!action || window.isDestroyed()) return;
      window.webContents.send("mediax:native-popup-event", { type: "action", action });
    }
  });
  on("refreshAccount", (id) => accounts.refresh(text(id)));
  on("deleteAccount", (id) => accounts.remove(text(id)));
  on("importMarkdown", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (result.canceled) return null;
    return markdownToText(await readFile(result.filePaths[0], "utf8"));
  });
  on("chooseImages", async (kind?: ContentKind) => {
    const filters = fileFilters(kind);
    const result = await dialog.showOpenDialog(window, {
      properties:
        kind === "article" || kind === "video" || kind === "audio"
          ? ["openFile"]
          : ["openFile", "multiSelections"],
      filters,
    });
    if (result.canceled) return [];
    if (kind === "article" && result.filePaths.length > 1) throw new Error("文章只能带一张封面");
    const imported = await mediaImportHost().import(result.filePaths, kind ?? "moment", images);
    if (!imported.assets.length && imported.warnings.length) throw new Error(imported.warnings[0]);
    return imported.assets;
  });
  on("importLocalFiles", async (paths, kind) => {
    if (!isContentKind(kind)) throw new Error("无效内容类型");
    if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string"))
      throw new Error("无效文件路径");
    return mediaImportHost().import(paths, kind, images);
  });
  on("openDownloadsFolder", async () => {
    const result = await electronShell.openPath(app.getPath("downloads"));
    if (result) throw new Error(result);
  });
  on("downloads", () => downloads.list());
  on("removeDownload", (id) => downloads.remove(text(id)));
  on("revealDownload", (id) => {
    const item = downloads.get(text(id));
    if (!item) throw new Error("下载项不存在");
    if (!downloads.canReveal(item.id)) throw new Error("文件尚不可用");
    electronShell.showItemInFolder(item.path);
  });
  on("copyDownloadUrl", (id) => {
    const item = downloads.get(text(id));
    if (!item?.url) throw new Error("下载地址不可用");
    clipboard.writeText(item.url);
  });
  on("copyDownloadPath", (id) => {
    const item = downloads.get(text(id));
    if (!item?.path) throw new Error("下载路径不可用");
    clipboard.writeText(item.path);
  });
  on("openExternalUrl", async (value) => {
    const url = text(value).trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("无效网址");
    await electronShell.openExternal(url);
  });
  on("revealInFolder", (path) => {
    electronShell.showItemInFolder(text(path));
  });
  on("saveDraft", (body, assets, kind, title) => {
    if (!isContentKind(kind)) throw new Error("无效内容类型");
    if (!Array.isArray(assets)) throw new Error("无效素材");
    const selected = assets.map((a) => {
      const known = images.get(a?.path);
      if (!known) throw new Error("请重新选择图片");
      return { path: known.path, name: known.name };
    });
    db.saveDraft(text(body), selected, kind, typeof title === "string" ? title : null);
  });
  on("loadDraft", async () => {
    const draft = db.draft();
    const assets: ImageAsset[] = [];
    for (const a of draft.images) {
      try {
        const data = await readFile(a.path);
        if (data.length > 20 * 1024 * 1024) continue;
        const media = isVideo(a.path) || isAudio(a.path);
        const asset = {
          ...a,
          preview: media ? "" : `data:${imageMime(a.path)};base64,${data.toString("base64")}`,
        };
        images.set(a.path, asset);
        assets.push(asset);
      } catch {}
    }
    return {
      body: draft.body,
      images: assets,
      contentKind: draft.contentKind,
      title: draft.title,
    };
  });
  on("history", () => ({
    tasks: db.tasks().map((task) => ({ ...task, cover: coverDataUrl(task.images[0]) })),
    targets: db.targets(),
  }));
  on("publish", (kind, title, body, paths, targets, scheduledAt) => {
    if (!isContentKind(kind)) throw new Error("无效内容类型");
    if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string"))
      throw new Error("请重新选择发布图片");
    for (const path of paths) {
      if (images.has(path)) continue;
      if (!isImage(path) && !isVideo(path) && !isAudio(path)) throw new Error("请重新选择发布素材");
      images.set(path, { path, name: basename(path), preview: "" });
    }
    if (
      !Array.isArray(targets) ||
      !targets.every(
        (t) =>
          t &&
          typeof t.accountId === "string" &&
          typeof t.identityId === "string" &&
          ["profile", "page"].includes(t.kind),
      )
    )
      throw new Error("无效发布目标");
    const when =
      scheduledAt === undefined || scheduledAt === null
        ? null
        : typeof scheduledAt === "string"
          ? scheduledAt
          : (() => {
              throw new Error("无效定时时间");
            })();
    return publishing.publish(
      kind,
      typeof title === "string" ? title : null,
      text(body),
      paths,
      targets,
      when,
    );
  });
  on("publishBatches", (kind, paths, batches, scheduledAt) => {
    if (!isContentKind(kind)) throw new Error("无效内容类型");
    if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string"))
      throw new Error("请重新选择发布图片");
    for (const path of paths) {
      if (images.has(path)) continue;
      if (!isImage(path) && !isVideo(path) && !isAudio(path)) throw new Error("请重新选择发布素材");
      images.set(path, { path, name: basename(path), preview: "" });
    }
    if (!Array.isArray(batches) || !batches.length) throw new Error("无效发布批次");
    const resolved = batches.map((batch) => {
      if (!batch || typeof batch !== "object") throw new Error("无效发布批次");
      const body = text((batch as { body?: unknown }).body);
      const titleValue = (batch as { title?: unknown }).title;
      const title = typeof titleValue === "string" ? titleValue : null;
      const targets = (batch as { targets?: unknown }).targets;
      if (
        !Array.isArray(targets) ||
        !targets.every(
          (t) =>
            t &&
            typeof t.accountId === "string" &&
            typeof t.identityId === "string" &&
            ["profile", "page"].includes(t.kind),
        )
      )
        throw new Error("无效发布目标");
      return { title, body, targets: targets as Target[] };
    });
    const when =
      scheduledAt === undefined || scheduledAt === null
        ? null
        : typeof scheduledAt === "string"
          ? scheduledAt
          : (() => {
              throw new Error("无效定时时间");
            })();
    return publishing.publishBatches(kind, paths, resolved, when);
  });
  on("calendar", (range) => {
    if (!range || typeof range !== "object") throw new Error("无效日历范围");
    const from = text((range as { from?: unknown }).from);
    const to = text((range as { to?: unknown }).to);
    if (Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime()))
      throw new Error("无效日历范围");
    return db
      .calendarEntries(new Date(from).toISOString(), new Date(to).toISOString())
      .map((entry) => ({
        ...entry,
        task: { ...entry.task, cover: coverDataUrl(entry.task.images[0]) },
      }));
  });
  on("rescheduleTask", (taskId, scheduledAt) =>
    publishing.rescheduleTask(text(taskId), text(scheduledAt)),
  );
  on("analyticsSummary", (query) => {
    if (typeof query === "number" && Number.isFinite(query)) return db.analyticsSummary(query);
    if (query && typeof query === "object") {
      const raw = query as { days?: unknown; from?: unknown; to?: unknown };
      return db.analyticsSummary({
        days: typeof raw.days === "number" && Number.isFinite(raw.days) ? raw.days : undefined,
        from: typeof raw.from === "string" ? raw.from : undefined,
        to: typeof raw.to === "string" ? raw.to : undefined,
      });
    }
    return db.analyticsSummary(30);
  });
  on("retry", (id) => publishing.retry(text(id)));
  on("republish", (id) => publishing.republish(text(id)));
  on("resume", (id) => publishing.resume(text(id)));
  on("openPost", async (value) => {
    const url = postUrl(text(value));
    if (!url || !db.targets().some((t) => t.url === url)) throw new Error("无效帖子链接");
    await electronShell.openExternal(url);
  });
  on("verifyTarget", (id, url) =>
    publishing.verify(text(id), url === undefined ? undefined : text(url)),
  );
  return publishing;
}

function toastOverlayPayload(value: unknown, windowWidth: number): ToastOverlay {
  if (!value || typeof value !== "object") throw new Error("无效通知叠层");
  const overlay = value as Record<string, unknown>;
  const number = (item: unknown, name: string) => {
    if (typeof item !== "number" || !Number.isFinite(item)) throw new Error(`无效通知${name}`);
    return item;
  };
  const width = number(overlay.width, "宽度");
  const height = number(overlay.height, "高度");
  if (width < 1 || height < 1 || width > windowWidth || height > 800)
    throw new Error("无效通知尺寸");
  const items = Array.isArray(overlay.toasts) ? overlay.toasts : [];
  return {
    x: number(overlay.x, "位置"),
    y: number(overlay.y, "位置"),
    width,
    height,
    theme: overlay.theme === "dark" ? "dark" : "light",
    toasts: items.slice(0, 3).map((item) => {
      if (!item || typeof item !== "object") throw new Error("无效通知条目");
      const toast = item as Record<string, unknown>;
      const title = typeof toast.title === "string" ? toast.title.slice(0, 200) : "";
      if (!title) throw new Error("无效通知文案");
      return {
        icon:
          typeof toast.icon === "string" &&
          toast.icon.startsWith("data:image/svg+xml,") &&
          toast.icon.length <= 16_000
            ? toast.icon
            : undefined,
        type: typeof toast.type === "string" ? toast.type.slice(0, 32) : "default",
        title,
        description:
          typeof toast.description === "string" ? toast.description.slice(0, 200) : undefined,
      };
    }),
  };
}

function previewOverlay(value: unknown): TabPreviewOverlay {
  if (!value || typeof value !== "object") throw new Error("无效预览");
  const preview = value as Record<string, unknown>;
  const number = (item: unknown, name: string) => {
    if (typeof item !== "number" || !Number.isFinite(item)) throw new Error(`无效预览${name}`);
    return item;
  };
  const line = (item: unknown) => {
    if (typeof item !== "string") throw new Error("无效预览文本");
    return item.slice(0, 200);
  };
  const width = number(preview.width, "宽度");
  const height = number(preview.height, "高度");
  if (width < 1 || height < 1 || width > 800 || height > 800) throw new Error("无效预览尺寸");
  let image: string | null = null;
  if (typeof preview.image === "string" && preview.image.length > 0) {
    if (!preview.image.startsWith("data:image/") || preview.image.length > 3_000_000)
      throw new Error("无效预览图片");
    image = preview.image;
  }
  return {
    x: number(preview.x, "位置"),
    y: number(preview.y, "位置"),
    width,
    height,
    label: line(preview.label),
    lines: Array.isArray(preview.lines) ? preview.lines.slice(0, 4).map(line) : [],
    image,
    alt: typeof preview.alt === "string" ? preview.alt.slice(0, 200) : "",
    placeholder: preview.placeholder === true,
  };
}

function imageMime(path: string) {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function isContentKind(value: unknown): value is ContentKind {
  return value === "article" || value === "moment" || value === "video" || value === "audio";
}

function fileFilters(kind?: ContentKind) {
  if (kind === "video") return [{ name: "视频", extensions: ["mp4", "mov", "m4v", "webm"] }];
  if (kind === "audio") return [{ name: "音频", extensions: ["mp3", "m4a", "wav", "aac", "flac"] }];
  if (kind === "article" || kind === "moment")
    return [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }];
  return [
    {
      name: "图片或视频",
      extensions: ["png", "jpg", "jpeg", "webp", "mp4", "mov", "m4v", "webm"],
    },
  ];
}
