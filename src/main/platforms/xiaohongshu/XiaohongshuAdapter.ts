import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, type Publisher } from "../Publisher";
import { discoverProfile, photos, replaceText, requireFile, waitUntil } from "../form";
import { isVideo, postTitle } from "../postText";

const videoUrl = "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=video";
const imageUrl = "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image";
const articleUrl = "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=article";

function loggedOut(url: string) {
  return /login|signin/i.test(url) || !url.includes("creator.xiaohongshu.com");
}

export class XiaohongshuAdapter implements Publisher {
  private usingEditor = false;
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("xiaohongshu");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("creator.xiaohongshu.com")) {
      await page.goto("https://creator.xiaohongshu.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
    return discoverProfile(page, accountId, "小红书账号", loggedOut, "xiaohongshu");
  }

  async prepare(task: Task, _target: TaskTarget) {
    this.usingEditor = task.contentKind === "article";
    if (this.usingEditor) {
      await openKindEditor(await this.page(), task, {
        url: articleUrl,
        loggedOut,
        hint: "请先在账号浏览器中登录 小红书",
        files: "cover",
      });
      return;
    }
    const video = task.contentKind === "video" ? task.images.find(isVideo) : undefined;
    const images = photos(task);
    if (!video && !images.length)
      throw new NeedsUser("小红书需要一段视频或图片，请附上素材后再发布");
    const page = await this.page();
    await page.goto(video ? videoUrl : imageUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 小红书");
    const input = await requireFile(
      page,
      video
        ? "div[class^='upload-content'] input.upload-input, input[type='file']"
        : 'input[type="file"][accept*="image"], div[class^="upload-content"] input.upload-input',
    );
    await input.setInputFiles(video ? video : images);
    await replaceText(
      page,
      page.locator('input[placeholder*="填写标题"]').first(),
      postTitle(task.body, 20, video ? "未命名视频" : "未命名图文"),
    );
    if (task.body.trim()) {
      await replaceText(
        page,
        page.locator('p[data-placeholder*="输入正文描述"]').first(),
        task.body.trim().slice(0, 1000),
      );
    }
    await waitUntil(
      page,
      async () => (await page.locator('button:has-text("发布")').count()) > 0,
      5 * 60 * 1000,
      "素材仍在上传，请稍后重试",
    );
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    if (this.usingEditor) {
      await submitKindEditor(page, markSubmitted);
      return;
    }
    const button = page.locator('button:has-text("发布")').last();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return page.url().includes("/publish/success") ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
