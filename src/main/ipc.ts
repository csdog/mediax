import { ipcMain, dialog, BrowserWindow } from "electron";
import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { markdownToText } from "./content/markdown";
import type { ImageAsset } from "../shared/models";
export function registerIpc(db: Database, accounts: AccountService, window: BrowserWindow) {
  const images = new Map<string, ImageAsset>();
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
  on("accounts", () => accounts.list());
  on("addAccount", (name) => accounts.add(text(name)));
  on("openAccount", (id) => accounts.open(text(id)));
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
  const unavailable = () => {
    throw new Error("Facebook 身份与发布流程尚未通过真实页面验收，暂不可执行发布");
  };
  on("publish", unavailable);
  on("retry", unavailable);
  on("resume", unavailable);
}
