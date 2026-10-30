import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { isPlatformLoginUrl, platformSites } from "../../../shared/platformSites";
import { openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, type Publisher } from "../Publisher";
import {
  discoverProfile,
  photos,
  replaceText,
  requireFile,
  requireVideo,
  waitUntil,
} from "../form";
import { postTitle } from "../postText";

const uploadUrl = "https://creator.douyin.com/creator-micro/content/upload";
const articleUrl = "https://creator.douyin.com/creator-micro/content/post/article";

function loggedOut(url: string) {
  return isPlatformLoginUrl("douyin", url) || new URL(url).hostname !== "creator.douyin.com";
}

export class DouyinAdapter implements Publisher {
  private usingEditor = false;
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("douyin");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (new URL(page.url()).hostname !== "creator.douyin.com") {
      await page.goto(platformSites.douyin.home, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, "抖音账号", loggedOut, "douyin");
  }

  async prepare(task: Task, _target: TaskTarget) {
    const page = await this.page();
    this.usingEditor = task.contentKind === "article";
    if (this.usingEditor) {
      await openKindEditor(page, task, {
        url: articleUrl,
        loggedOut,
        hint: "请先在账号浏览器中登录 抖音",
        files: "cover",
      });
      return;
    }
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url()) || (await page.getByText("手机号登录").count()))
      throw new NeedsUser("请先在账号浏览器中登录 抖音");
    if (task.contentKind === "video") {
      await this.prepareVideo(page, task, requireVideo(task, "抖音"));
      return;
    }
    if (photos(task).length) {
      await this.prepareNote(page, task);
      return;
    }
    throw new NeedsUser("抖音需要一段视频或图片，请附上素材后再发布");
  }

  private async prepareVideo(page: Page, task: Task, video: string) {
    const input = await requireFile(
      page,
      "input.upload-btn-input, div[class^='container'] input[type='file']",
    );
    await input.setInputFiles(video);
    await waitUntil(
      page,
      async () => /content\/(publish|post\/video)/.test(page.url()),
      120000,
      "视频仍在进入发布页，请稍后重试",
    );
    await replaceText(
      page,
      page.locator('input[placeholder*="填写作品标题"]').first(),
      postTitle(task.body, 30, "未命名视频"),
    );
    const editor = page.locator('div.zone-container[contenteditable="true"]').first();
    if (task.body.trim()) await replaceText(page, editor, task.body.trim().slice(0, 1000));
    await waitUntil(
      page,
      async () => (await page.locator('[class^="long-card"] div:has-text("重新上传")').count()) > 0,
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  private async prepareNote(page: Page, task: Task) {
    await page.getByText("发布图文", { exact: true }).click();
    const input = await requireFile(page, "div[class^='container'] input[accept*='image']");
    await input.setInputFiles(photos(task).slice(0, 35));
    await waitUntil(
      page,
      async () => page.url().includes("/post/image"),
      120000,
      "图片仍在进入发布页，请稍后重试",
    );
    await replaceText(
      page,
      page.locator('input[placeholder*="填写作品标题"]').first(),
      postTitle(task.body, 20, "未命名图文"),
    );
    if (task.body.trim()) {
      await replaceText(
        page,
        page.locator('div.zone-container[contenteditable="true"]').first(),
        task.body.trim().slice(0, 1000),
      );
    }
    await page.getByRole("button", { name: "发布", exact: true }).waitFor({
      state: "visible",
      timeout: 60000,
    });
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    if (this.usingEditor) {
      await submitKindEditor(page, markSubmitted);
      return;
    }
    const button = page.getByRole("button", { name: "发布", exact: true });
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return page.url().includes("/content/manage") ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
