import { discoverProfile } from "../form";
import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";
import { isVideo, postTitle } from "../postText";

// old.reddit keeps a stable title/body form. The post goes to the signed-in profile
// (u_username), which is the session this app already stores.
export class RedditAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("reddit");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    await page.goto("https://old.reddit.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    return discoverProfile(
      page,
      accountId,
      "Reddit",
      (url) => /login|signin|accounts.google.com/i.test(url),
      "reddit",
    );
  }

  async prepare(task: Task, target: TaskTarget) {
    if (task.contentKind !== "article") throw new NeedsUser("Reddit 目前只发布文章");
    if (task.images.some(isVideo))
      throw new NeedsUser("Reddit 目前发布文字帖。视频请改用 YouTube。");
    if (task.images.length) throw new NeedsUser("Reddit 目前发布文字帖。图片请改用 Facebook。");
    const page = await this.page();
    await page.goto("https://old.reddit.com/submit?selftext=true", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    if (page.url().includes("/login")) throw new NeedsUser("请先在账号浏览器中登录 Reddit");
    const community = page.locator('input[name="sr"]').first();
    const handle = target.name.replace(/^u\//, "");
    if (await community.count()) await community.fill(`u_${handle}`);
    const title = page.locator('textarea[name="title"], input[name="title"]').first();
    await title.waitFor({ state: "visible", timeout: 20000 });
    await title.fill((task.title?.trim() || postTitle(task.body, 300, "未命名帖子")).slice(0, 300));
    const body = page.locator('textarea[name="text"]').first();
    if (await body.count()) await body.fill(task.body.slice(0, 40000));
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const button = page
      .locator('button[name="submit"], button[type="submit"]')
      .filter({ visible: true })
      .last();
    if (!(await button.count())) throw new NeedsUser("未找到 Reddit 提交按钮");
    markSubmitted();
    await button.click();
  }

  async verifyExisting(
    _task: Task,
    target: TaskTarget,
    suppliedUrl?: string,
  ): Promise<string | null> {
    const candidate = suppliedUrl || target.url || "";
    if (/reddit\.com/.test(candidate) && /\/comments\//.test(candidate)) return candidate;
    return this.verify();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    const url = page.url();
    if (!/reddit\.com/.test(url) || !/\/comments\//.test(url)) return null;
    return url;
  }
}
