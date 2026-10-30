import { discoverProfile } from "../form";
import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, NotSubmitted, type Publisher } from "../Publisher";
import { isVideo, postTitle } from "../postText";

// Studio upload follows social-auto-upload's YouTube flow: an unaudited Data API
// project locks videos to private, so publishing stays in the signed-in Studio page.
const uploadUrl = "https://www.youtube.com/upload";

async function clickFirst(page: Page, selector: string, timeout = 8000) {
  const element = page.locator(selector).first();
  try {
    await element.waitFor({ state: "visible", timeout });
    await element.click();
    return true;
  } catch {
    return false;
  }
}

async function fillEditable(page: Page, selector: string, text: string) {
  const box = page.locator(selector).first();
  await box.waitFor({ state: "visible", timeout: 30000 });
  await box.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Delete");
  try {
    await box.fill(text);
  } catch {
    await box.pressSequentially(text, { delay: 6 });
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const dropdown = page.locator("tp-yt-iron-dropdown:visible");
  if (await dropdown.count()) await page.keyboard.press("Escape");
}

export class YouTubeAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("youtube");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    await page.goto("https://studio.youtube.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    return discoverProfile(
      page,
      accountId,
      "YouTube",
      (url) => /login|signin|accounts.google.com/i.test(url),
      "youtube",
    );
  }

  async prepare(task: Task, _target: TaskTarget) {
    if (task.contentKind !== "video") throw new NeedsUser("YouTube 目前只发布视频");
    const video = task.images.find(isVideo);
    if (!video) throw new NeedsUser("YouTube 需要一段视频，请在正文中附上视频后再发布");
    const page = await this.page();
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (page.url().includes("accounts.google.com") || /signin/i.test(page.url()))
      throw new NeedsUser("请先在账号浏览器中登录 YouTube");
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 60000 });
    await input.setInputFiles(video);
    await page.locator("#title-textarea").waitFor({ state: "visible", timeout: 120000 });
    await fillEditable(page, "#title-textarea #textbox", postTitle(task.body, 100, "未命名视频"));
    if (task.body.trim())
      await fillEditable(page, "#description-textarea #textbox", task.body.slice(0, 5000));
    const kids =
      (await clickFirst(
        page,
        "tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']",
        10000,
      )) ||
      (await clickFirst(
        page,
        "tp-yt-paper-radio-button:has-text('不是面向儿童'), tp-yt-paper-radio-button:has-text('not made for kids')",
        6000,
      ));
    if (!kids) throw new NeedsUser("请在 YouTube 上传窗口选择「不是面向儿童」");
    for (let step = 0; step < 5; step++) {
      const visibility = page.locator("tp-yt-paper-radio-button[name='PUBLIC']");
      if ((await visibility.count()) && (await visibility.first().isVisible())) break;
      if (!(await clickFirst(page, "#next-button", 6000))) await page.waitForTimeout(1200);
      await page.waitForTimeout(800);
    }
    if (!(await clickFirst(page, "tp-yt-paper-radio-button[name='PUBLIC']", 10000)))
      throw new NeedsUser("未找到公开选项，请在上传窗口中手动选择可见性");
    const done = page.locator("#done-button");
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      if (
        (await done.count()) &&
        (await done
          .first()
          .isEnabled()
          .catch(() => false))
      )
        return;
      await page.waitForTimeout(2000);
    }
    throw new NotSubmitted("视频仍在上传，请稍后重试");
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const done = page.locator("#done-button").first();
    await done.waitFor({ state: "visible", timeout: 15000 });
    if (!(await done.isEnabled())) throw new NotSubmitted("发布按钮还不可用，视频可能仍在上传");
    markSubmitted();
    await done.click();
  }

  async verifyExisting(
    _task: Task,
    target: TaskTarget,
    suppliedUrl?: string,
  ): Promise<string | null> {
    const candidate = suppliedUrl || target.url || "";
    if (/youtu\.be|watch\?v=/.test(candidate)) return candidate;
    return this.verify();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    const link = page.locator("a[href*='youtu.be'], a[href*='watch?v=']").first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      if (href) return href;
    }
    return /watch\?v=|youtu\.be\//.test(page.url()) ? page.url() : null;
  }
}
