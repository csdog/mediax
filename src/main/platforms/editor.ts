import type { Page } from "playwright-core";
import type { ContentKind, Task } from "../../shared/models";
import { isAudio, isVideo } from "../../shared/content";
import { NeedsUser } from "./Publisher";
import { photos, replaceText, requireFile } from "./form";
import { postTitle } from "./postText";

export type EditorFiles = "images" | "video" | "audio" | "cover" | "none";

export type KindEditor = {
  url: string;
  loggedOut: (url: string) => boolean;
  hint: string;
  files: EditorFiles;
};

const publishNames = ["发布", "发表", "立即投稿", "Post", "Share", "分享", "发帖"];

function filesFor(task: Task, mode: EditorFiles) {
  if (mode === "none") return [];
  if (mode === "video") return task.images.filter(isVideo).slice(0, 1);
  if (mode === "audio") return task.images.filter(isAudio).slice(0, 1);
  if (mode === "cover") return photos(task).slice(0, 1);
  return photos(task);
}

export async function openKindEditor(page: Page, task: Task, spec: KindEditor) {
  await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (spec.loggedOut(page.url())) throw new NeedsUser(spec.hint);
  const files = filesFor(task, spec.files);
  if ((spec.files === "video" || spec.files === "audio") && !files.length)
    throw new NeedsUser(spec.files === "video" ? "请先选择一个视频文件" : "请先选择一个音频文件");
  if (files.length) {
    const input = await requireFile(page, 'input[type="file"]');
    await input.setInputFiles(files.length === 1 ? files[0] : files);
  }
  if (task.contentKind === "article" || task.title) {
    const title = page
      .locator(
        "input[placeholder*='标题'], textarea[placeholder*='标题'], input[name='title'], textarea[name='title']",
      )
      .first();
    if (await title.count())
      await replaceText(
        page,
        title,
        (task.title?.trim() || postTitle(task.body, 80, "未命名")).slice(0, 80),
      );
  }
  if (task.body.trim()) {
    const body = page
      .locator(
        "[contenteditable='true']:not([placeholder*='标题']):not([name='title']), textarea:not([placeholder*='标题']):not([name='title'])",
      )
      .first();
    if (await body.count()) await replaceText(page, body, task.body);
  }
}

export async function submitKindEditor(page: Page, markSubmitted: () => void) {
  for (const name of publishNames) {
    const button = page.getByRole("button", { name, exact: true }).first();
    if (await button.count()) {
      markSubmitted();
      await button.click();
      return;
    }
  }
  throw new NeedsUser("未找到发布按钮，请在账号浏览器中完成发布");
}

export function editorFiles(kind: ContentKind): EditorFiles {
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  if (kind === "article") return "cover";
  if (kind === "moment") return "images";
  return "none";
}
