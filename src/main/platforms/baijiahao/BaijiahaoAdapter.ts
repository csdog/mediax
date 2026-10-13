import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, type Publisher } from "../Publisher";
import {
  coverImage,
  discoverProfile,
  replaceText,
  requireFile,
  requireVideo,
  waitUntil,
} from "../form";
import { postTitle } from "../postText";

const publishUrl = "https://baijiahao.baidu.com/builder/rc/edit?type=videoV2";

function loggedOut(url: string) {
  return /\/login|passport\.baidu\.com/i.test(url);
}

function titleOf(body: string) {
  const title = postTitle(body, 30, "未命名视频分享");
  return title.length >= 9 ? title : `${title} 你不知道的`.slice(0, 30);
}

export class BaijiahaoAdapter implements Publisher {
  private usingEditor = false;
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("baijiahao");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("baijiahao.baidu.com")) {
      await page.goto("https://baijiahao.baidu.com/builder/rc/home", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
    return discoverProfile(page, accountId, "百家号", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    this.usingEditor = task.contentKind === "article" || task.contentKind === "moment";
    if (this.usingEditor) {
      await openKindEditor(await this.page(), task, {
        url:
          task.contentKind === "article"
            ? "https://baijiahao.baidu.com/builder/rc/edit?type=news"
            : "https://baijiahao.baidu.com/builder/rc/edit?type=events",
        loggedOut,
        hint: "请先在账号浏览器中登录 百家号",
        files: task.contentKind === "article" ? "cover" : "images",
      });
      return;
    }
    const video = requireVideo(task, "百家号");
    const cover = coverImage(task);
    if (!cover) throw new NeedsUser("百家号需要一张横版封面，请在正文中附上图片");
    const page = await this.page();
    await page.goto(publishUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 百家号");
    const input = await requireFile(
      page,
      'input[type="file"][accept*="video"], input[type="file"][accept*="mp4"], input[type="file"]',
    );
    await input.setInputFiles(video);
    await replaceText(
      page,
      page.locator('div[class*="contentEditable"]').first(),
      titleOf(task.body),
    );
    await this.uploadCover(page, cover);
    await waitUntil(
      page,
      async () => {
        const button = page
          .locator('button:text-is("发布"), button[data-testid="publish-btn"]')
          .first();
        return (await button.count()) > 0 && (await button.isEnabled().catch(() => false));
      },
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  private async uploadCover(page: Page, cover: string) {
    const entry = page.getByText("选择封面", { exact: false }).first();
    if (await entry.count()) await entry.click();
    const image = page.locator('input[type="file"][accept*="image"]').last();
    await image.waitFor({ state: "attached", timeout: 20000 });
    await image.setInputFiles(cover);
    const confirm = page
      .locator('button:has-text("确定"), button:has-text("完成"), button:has-text("确认")')
      .first();
    if (await confirm.count()) await confirm.click();
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    if (this.usingEditor) {
      await submitKindEditor(page, markSubmitted);
      return;
    }
    const button = page
      .locator('button:text-is("发布"), button[data-testid="publish-btn"]')
      .first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return page.url().includes("/builder/rc/clue") ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
