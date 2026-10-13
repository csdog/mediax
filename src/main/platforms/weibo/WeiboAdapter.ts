import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, NotSubmitted, type Publisher } from "../Publisher";
import { coverImage, discoverProfile, replaceText, requireVideo, waitUntil } from "../form";
import { postTitle } from "../postText";

function loggedOut(url: string) {
  return /passport\.weibo\.com|\/newlogin|openLoginLayer/i.test(url);
}

export class WeiboAdapter implements Publisher {
  private composer: Page | null = null;
  private usingEditor = false;
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("weibo");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("weibo.com")) {
      await page.goto("https://weibo.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, "微博账号", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    this.usingEditor = task.contentKind === "article" || task.contentKind === "moment";
    if (this.usingEditor) {
      this.composer = null;
      await openKindEditor(await this.page(), task, {
        url:
          task.contentKind === "article"
            ? "https://card.weibo.com/article/v5/editor"
            : "https://weibo.com/",
        loggedOut,
        hint: "请先在账号浏览器中登录 微博",
        files: task.contentKind === "article" ? "cover" : "images",
      });
      return;
    }
    const video = requireVideo(task, "微博");
    const cover = coverImage(task);
    if (!cover) throw new NeedsUser("微博视频需要一张封面，请在正文中附上图片");
    const home = await this.page();
    await home.goto("https://weibo.com/", { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(home.url())) throw new NeedsUser("请先在账号浏览器中登录 微博");
    const popup = home.waitForEvent("popup", { timeout: 20000 });
    await home.locator("span").filter({ hasText: "视频" }).first().click();
    this.composer = await popup;
    const page = this.composer;
    const upload = page.getByRole("button", { name: "上传视频" });
    await upload.waitFor({ state: "visible", timeout: 20000 });
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
    await upload.click();
    await (await chooser).setFiles(video);
    await waitUntil(
      page,
      async () =>
        (await page.locator('div:has(> i.woo-font--check) span:text-is("上传完成")').count()) > 0,
      8 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
    await replaceText(
      page,
      page.getByPlaceholder("填写标题（0～30个字）"),
      postTitle(task.body, 30, "未命名视频"),
    );
    if (task.body.trim()) {
      await replaceText(
        page,
        page.getByPlaceholder("有什么新鲜事想分享给大家？"),
        task.body.trim().slice(0, 2000),
      );
    }
    await this.uploadCover(page, cover);
  }

  private async uploadCover(page: Page, cover: string) {
    const link = page.getByRole("link", { name: "上传封面" }).first();
    await link.click();
    const input = page.locator('input[type="file"]').last();
    await input.setInputFiles(cover);
    const done = page.locator('button:has(span:text-is("完成"))').first();
    await done.waitFor({ state: "visible", timeout: 20000 });
    await done.click();
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    if (this.usingEditor) {
      await submitKindEditor(await this.page(), markSubmitted);
      return;
    }
    const page = this.composer;
    if (!page) throw new NotSubmitted("微博发布页还没打开");
    const button = page.getByRole("button", { name: "发布" }).first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = this.composer ?? (await this.page());
    if (await page.locator('button:has(span:text-is("再发一条视频"))').count()) return page.url();
    return null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
