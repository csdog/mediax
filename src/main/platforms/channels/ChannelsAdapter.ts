import type { Locator, Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, type Publisher } from "../Publisher";
import { discoverProfile, replaceText, requireVideo, selectAll, waitUntil } from "../form";
import { postTitle } from "../postText";
import { isChannelsPlatformUrl } from "./session";

const homeUrl = "https://channels.weixin.qq.com/platform";

function loggedOut(url: string) {
  return /login\.html|qrconnect/i.test(url);
}

function shortTitle(body: string) {
  const title = postTitle(body, 15, "精彩视频内容分享").replace(
    /[^\w\u4e00-\u9fa5《》“”:+?%°]/g,
    "",
  );
  if (title.length >= 7) return title.slice(0, 15);
  return `${title}，精彩内容分享`.slice(0, 7);
}

async function fileInput(page: Page): Promise<Locator> {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    for (const frame of page.frames()) {
      const input = frame.locator('input[type="file"]').first();
      if (await input.count()) return input;
    }
    await page.waitForTimeout(1500);
  }
  throw new NeedsUser("未找到视频号文件上传框，请在账号浏览器中打开发表页");
}

export class ChannelsAdapter implements Publisher {
  private usingEditor = false;
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("channels");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    // Login polling can run during the QR handoff. Never navigate away from it.
    if (!isChannelsPlatformUrl(page.url())) return [];
    return discoverProfile(page, accountId, "视频号", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    this.usingEditor = task.contentKind === "moment";
    if (this.usingEditor) {
      await openKindEditor(await this.page(), task, {
        url: "https://channels.weixin.qq.com/platform/post/create",
        loggedOut,
        hint: "请先在账号浏览器中登录 视频号",
        files: "images",
      });
      return;
    }
    const video = requireVideo(task, "视频号");
    const page = await this.page();
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 视频号");
    const entry = page.locator("button.weui-desktop-btn", { hasText: "发表视频" }).first();
    await entry.waitFor({ state: "visible", timeout: 30000 });
    await entry.click();
    await page.waitForURL("**/platform/post/create", { timeout: 60000 }).catch(() => {});
    await (await fileInput(page)).setInputFiles(video);
    const editor = page.locator("div.input-editor").first();
    await editor.waitFor({ state: "visible", timeout: 120000 });
    await editor.click();
    await page.keyboard.press(selectAll());
    await page.keyboard.press("Delete");
    await page.keyboard.insertText(task.body.trim().slice(0, 1000) || "未命名视频");
    const title = page.locator('input[placeholder*="短标题"]').first();
    if (await title.count()) await replaceText(page, title, shortTitle(task.body));
    await waitUntil(
      page,
      async () => {
        const button = page.locator('div.form-btns button:has-text("发表")').first();
        return (await button.count()) > 0 && (await button.isEnabled().catch(() => false));
      },
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    if (this.usingEditor) {
      await submitKindEditor(page, markSubmitted);
      return;
    }
    const button = page.getByRole("button", { name: "发表", exact: true }).first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    const url = page.url();
    if (url.includes("/post/list") || (url.includes("/platform") && !url.includes("/post/create")))
      return url;
    return null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
