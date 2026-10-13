import type { FrameLocator, Locator, Page } from "playwright-core";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, NotSubmitted, type Publisher } from "../Publisher";
import { isVideo } from "../postText";

// Upload follows social-auto-upload's TikTok Studio flow: open the upload page,
// attach the video, fill the caption, and click Post only after the button enables.
const uploadUrl = "https://www.tiktok.com/tiktokstudio/upload?lang=en";

async function uploadScope(page: Page): Promise<Page | FrameLocator> {
  const iframe = page.locator('iframe[data-tt="Upload_index_iframe"]');
  if (await iframe.count()) return page.frameLocator('iframe[data-tt="Upload_index_iframe"]');
  return page;
}

function postButton(scope: Page | FrameLocator): Locator {
  return scope
    .locator('div.btn-post button, button[data-e2e="post_video_button"]')
    .filter({ visible: true })
    .first();
}

async function attachVideo(page: Page, scope: Page | FrameLocator, video: string) {
  const input = scope.locator('input[type="file"]').first();
  if (await input.count()) {
    await input.setInputFiles(video);
    return;
  }
  const select = scope
    .locator('button:has-text("Select video"), button:has-text("选择视频")')
    .first();
  const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
  await select.click();
  await (await chooser).setFiles(video);
}

async function fillCaption(page: Page, scope: Page | FrameLocator, caption: string) {
  const editor = scope.locator("div.public-DraftEditor-content").first();
  await editor.waitFor({ state: "visible", timeout: 60000 });
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(caption);
}

export class TikTokAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    await page.goto("https://www.tiktok.com/tiktokstudio", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) return [];
    const href = await page
      .locator('a[href*="/@"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    const handle = href?.match(/@([^/?#]+)/)?.[1];
    return [
      {
        accountId,
        identityId: handle ?? "account",
        name: handle ? `@${handle}` : "TikTok 账号",
        kind: "profile",
      },
    ];
  }

  async prepare(task: Task, _target: TaskTarget) {
    const video = task.images.find(isVideo);
    if (!video) throw new NeedsUser("TikTok 需要一段视频，请在正文中附上视频后再发布");
    const page = await this.page();
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (page.url().includes("/login")) throw new NeedsUser("请先在账号浏览器中登录 TikTok");
    await page
      .locator('iframe[data-tt="Upload_index_iframe"], input[type="file"], div.upload-container')
      .first()
      .waitFor({ state: "attached", timeout: 20000 })
      .catch(() => {});
    const scope = await uploadScope(page);
    await attachVideo(page, scope, video);
    const caption = task.body.trim().slice(0, 2200) || "未命名视频";
    await fillCaption(page, scope, caption);
    const button = postButton(scope);
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      if (await button.count()) {
        const disabled = await button.getAttribute("disabled");
        const ariaDisabled = await button.getAttribute("aria-disabled");
        if (disabled === null && ariaDisabled !== "true") return;
      }
      await page.waitForTimeout(2000);
    }
    throw new NotSubmitted("视频仍在上传，请稍后重试");
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const button = postButton(await uploadScope(page));
    await button.waitFor({ state: "visible", timeout: 15000 });
    if ((await button.getAttribute("disabled")) !== null)
      throw new NotSubmitted("发布按钮还不可用，视频可能仍在上传");
    markSubmitted();
    await button.click();
  }

  async verifyExisting(
    _task: Task,
    target: TaskTarget,
    suppliedUrl?: string,
  ): Promise<string | null> {
    const candidate = suppliedUrl || target.url || "";
    if (/tiktok\.com\/@[^/]+\/video\//.test(candidate)) return candidate;
    return this.verify();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    const link = page.locator('a[href*="/video/"]').first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      if (href) return new URL(href, "https://www.tiktok.com").href;
    }
    return /tiktok\.com\/@[^/]+\/video\//.test(page.url()) ? page.url() : null;
  }
}
