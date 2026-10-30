import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";
import { discoverProfile, replaceText, requireFile, requireVideo, waitUntil } from "../form";
import { postTitle } from "../postText";

const homeUrl =
  "https://c.alipay.com/page/life-account/index?_appScene=CONTENT&appId=2030022469359777";

function loggedOut(url: string) {
  return /auth\.alipay\.com|\/login/i.test(url);
}

export class AlipayAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("alipay");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("c.alipay.com")) {
      await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, "支付宝生活号", loggedOut, "alipay");
  }

  async prepare(task: Task, _target: TaskTarget) {
    if (task.contentKind !== "video") throw new NeedsUser("支付宝生活号目前只发布视频");
    const video = requireVideo(task, "支付宝生活号");
    const page = await this.page();
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 支付宝生活号");
    const entry = page.locator('a:has-text("发布视频")').first();
    await entry.waitFor({ state: "visible", timeout: 30000 });
    await entry.click();
    const input = await requireFile(page, 'input[type="file"]');
    await input.setInputFiles(video);
    await replaceText(
      page,
      page.getByPlaceholder("一个好的标题，能获得更多人的喜欢哦").first(),
      postTitle(task.body, 30, "未命名视频"),
    );
    if (task.body.trim()) {
      await replaceText(
        page,
        page.getByPlaceholder("填写作品描述，让你的作品更容易被看到").first(),
        task.body.trim().slice(0, 1000),
      );
    }
    await waitUntil(
      page,
      async () => {
        const button = page.getByRole("button", { name: "确认发布" }).first();
        return (await button.count()) > 0 && (await button.isEnabled().catch(() => false));
      },
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const button = page.getByRole("button", { name: "确认发布" }).first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
    const proceed = page.locator('button:has-text("继续发布")').first();
    if (await proceed.count()) await proceed.click().catch(() => {});
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return page.url().includes("/content-creation/posts") ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
