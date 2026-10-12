import { ipcMain, dialog, BrowserWindow, app, shell as electronShell } from "electron";
import { readFile } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import { postUrl } from "./platforms/facebook/FacebookAdapter";
import { PublishService } from "./publish/PublishService";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { markdownToText } from "./content/markdown";
import type { DesktopShell } from "./desktop/DesktopShell";
import type { ImageAsset } from "../shared/models";
export function registerIpc(
  db: Database,
  accounts: AccountService,
  window: BrowserWindow,
  rendererReady: () => void,
  shell: DesktopShell,
) {
  const images = new Map<string, ImageAsset>();
  const publishing = new PublishService(db, accounts, join(app.getPath("userData"), "task-assets"));
  const text = (value: unknown) => {
    if (typeof value !== "string") throw new Error("无效文本");
    return value;
  };
  const on = (name: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(`media-post:${name}`, (event, ...args) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
        throw new Error("拒绝非应用页面调用");
      return fn(...args);
    });
  on("rendererReady", rendererReady);
  on("workspaceSession", () => db.setting("workspaceSession") ?? null);
  on("saveWorkspaceSession", (value) => {
    if (
      !value ||
      !Array.isArray(value.tabs) ||
      value.tabs.length > 100 ||
      !["accounts", "compose", "history"].includes(value.page)
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
  on("accounts", () => accounts.list());
  on("addAccount", (name) => accounts.add(text(name)));
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
  on("refreshAccount", (id) => accounts.refresh(text(id)));
  on("importMarkdown", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (result.canceled) return null;
    return markdownToText(await readFile(result.filePaths[0], "utf8"));
  });
  on("chooseImages", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled) return [];
    const assets: ImageAsset[] = [];
    for (const path of result.filePaths) {
      const data = await readFile(path);
      if (data.length > 20 * 1024 * 1024) throw new Error("图片预览限制为 20MB，请压缩后选择");
      const mime =
        extname(path).toLowerCase() === ".png"
          ? "image/png"
          : extname(path).toLowerCase() === ".webp"
            ? "image/webp"
            : "image/jpeg";
      const asset = {
        path,
        name: basename(path),
        preview: `data:${mime};base64,${data.toString("base64")}`,
      };
      images.set(path, asset);
      assets.push(asset);
    }
    return assets;
  });
  on("saveDraft", (body, assets) => {
    if (!Array.isArray(assets)) throw new Error("无效素材");
    const selected = assets.map((a) => {
      const known = images.get(a?.path);
      if (!known) throw new Error("请重新选择图片");
      return { path: known.path, name: known.name };
    });
    db.saveDraft(text(body), selected);
  });
  on("loadDraft", async () => {
    const draft = db.draft();
    const assets: ImageAsset[] = [];
    for (const a of draft.images) {
      try {
        const data = await readFile(a.path);
        if (data.length > 20 * 1024 * 1024) continue;
        const mime =
          extname(a.path) === ".png"
            ? "image/png"
            : extname(a.path) === ".webp"
              ? "image/webp"
              : "image/jpeg";
        const asset = {
          ...a,
          preview: `data:${mime};base64,${data.toString("base64")}`,
        };
        images.set(a.path, asset);
        assets.push(asset);
      } catch {}
    }
    return { body: draft.body, images: assets };
  });
  on("history", () => ({ tasks: db.tasks(), targets: db.targets() }));
  on("publish", (body, paths, targets) => {
    if (
      !Array.isArray(paths) ||
      !paths.every((path) => typeof path === "string" && images.has(path))
    )
      throw new Error("请重新选择发布图片");
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
    return publishing.publish(text(body), paths, targets);
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
