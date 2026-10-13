import { ipcMain, dialog, BrowserWindow, app, nativeImage, shell as electronShell } from "electron";
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
import {
  isPlatform,
  type ContentKind,
  type ImageAsset,
  type TabPreviewOverlay,
} from "../shared/models";
import { parseProfile, readProfile } from "../shared/profile";
import {
  mergePublishSettings,
  readPublishSettings,
  type PublishSettings,
} from "../shared/publishSettings";
import type { DesktopShell } from "./desktop/DesktopShell";
import { TabPreviewWindow } from "./desktop/TabPreviewWindow";

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
  const publishing = new PublishService(db, accounts, join(app.getPath("userData"), "task-assets"));
  const text = (value: unknown) => {
    if (typeof value !== "string") throw new Error("无效文本");
    return value;
  };
  const on = (name: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(`media-post:${name}`, async (event, ...args) => {
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
      !["accounts", "compose", "video", "history"].includes(value.page)
    )
      throw new Error("无效标签页状态");
    const accountIds = new Set(db.accounts().map((account) => account.id));
    const ids = new Set<string>();
    const tabs = value.tabs.map((tab: { id: string; kind?: string }) => {
      if (
        !tab ||
        typeof tab.id !== "string" ||
        ids.has(tab.id) ||
        (tab.kind === "new"
          ? !/^new-[a-zA-Z0-9-]{1,80}$/.test(tab.id)
          : tab.kind !== undefined || !accountIds.has(tab.id))
      )
        throw new Error("无效标签页");
      ids.add(tab.id);
      return tab.kind === "new" ? { id: tab.id, kind: "new" } : { id: tab.id };
    });
    if (value.activeId !== null && !ids.has(value.activeId)) throw new Error("无效活动标签页");
    db.setSetting("workspaceSession", { tabs, activeId: value.activeId, page: value.page });
  });
  on("shortcutSettings", () => shell.shortcutSettings());
  on("setGlobalShortcut", (accelerator) => shell.setGlobalShortcut(text(accelerator)));
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
  on("accounts", () => accounts.list());
  on("addAccount", (name, platform) => {
    if (!isPlatform(platform)) throw new Error("暂不支持该平台");
    return accounts.add(text(name), platform);
  });
  on("previewAccountBrowser", (id) => accounts.preview(text(id)));
  on("openAccount", (id) => accounts.open(text(id)));
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
    const assets: ImageAsset[] = [];
    for (const path of result.filePaths) {
      const data = await readFile(path);
      if (data.length > 20 * 1024 * 1024) throw new Error("素材限制为 20MB，请压缩后选择");
      if (!acceptsFile(kind, path)) throw new Error("所选文件与当前内容类型不符");
      const media = isVideo(path) || isAudio(path);
      const mime = imageMime(path);
      const asset = {
        path,
        name: basename(path),
        preview: media ? "" : `data:${mime};base64,${data.toString("base64")}`,
      };
      images.set(path, asset);
      assets.push(asset);
    }
    return assets;
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
  on("publish", (kind, title, body, paths, targets) => {
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
    return publishing.publish(
      kind,
      typeof title === "string" ? title : null,
      text(body),
      paths,
      targets,
    );
  });
  on("retry", (id) => publishing.retry(text(id)));
  on("resume", (id) => publishing.resume(text(id)));
  on("openPost", async (value) => {
    const url = postUrl(text(value));
    if (!url || !db.targets().some((t) => t.url === url)) throw new Error("无效帖子链接");
    await electronShell.openExternal(url);
  });
  on("verifyTarget", (id, url) =>
    publishing.verify(text(id), url === undefined ? undefined : text(url)),
  );
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

function acceptsFile(kind: ContentKind | undefined, path: string) {
  if (kind === "video") return isVideo(path);
  if (kind === "audio") return isAudio(path);
  if (kind === "article" || kind === "moment") return isImage(path);
  return isImage(path) || isVideo(path);
}
