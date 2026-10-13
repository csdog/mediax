import type { Page } from "playwright-core";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";
import {
  discoverProfile,
  replaceText,
  requireFile,
  requireVideo,
  selectAll,
  waitUntil,
} from "../form";
import { postTitle } from "../postText";

const uploadUrl = "https://member.bilibili.com/platform/upload/video/frame";

function loggedOut(url: string) {
  return /passport\.bilibili\.com|\/login/i.test(url);
}

export class BilibiliAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("bilibili.com")) {
      await page.goto("https://member.bilibili.com/platform/home", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
    return discoverProfile(page, accountId, "哔哩哔哩", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    const video = requireVideo(task, "哔哩哔哩");
    const page = await this.page();
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 哔哩哔哩");
    const input = await requireFile(page, 'input[type="file"]');
    await input.setInputFiles(video);
    await replaceText(
      page,
      page.locator('input[placeholder*="标题"], .video-title input, input.input-val').first(),
      postTitle(task.body, 80, "未命名视频"),
    );
    const editor = page.locator(".ql-editor, textarea[placeholder*='简介']").first();
    if ((await editor.count()) && task.body.trim()) {
      await editor.click();
      await page.keyboard.press(selectAll());
      await page.keyboard.press("Delete");
      await page.keyboard.insertText(task.body.trim().slice(0, 2000));
    }
    await this.pickPartition(page);
    await waitUntil(
      page,
      async () => {
        const button = page.locator('button:has-text("立即投稿")').first();
        return (await button.count()) > 0 && (await button.isEnabled().catch(() => false));
      },
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  private async pickPartition(page: Page) {
    const chosen = page.locator(".selected-item, .drop-cascader-selected").first();
    if ((await chosen.count()) && (await chosen.innerText().catch(() => "")).trim()) return;
    const trigger = page.getByText("请选择分区").first();
    if (!(await trigger.count())) return;
    await trigger.click();
    const option = page.locator(".drop-cascader-list-item, .selector-item").first();
    if (await option.count()) await option.click();
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const button = page.locator('button:has-text("立即投稿")').first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    if (!(await button.isEnabled())) throw new NeedsUser("请在投稿页选择分区后再发布");
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return /upload\/video\/(success|frame\/success)|\/platform\/upload\/video\/manage/.test(
      page.url(),
    )
      ? page.url()
      : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
