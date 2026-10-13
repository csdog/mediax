import type { Page } from "playwright-core";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";
import { discoverProfile, replaceText, requireVideo, waitUntil } from "../form";
import { postTitle } from "../postText";

const publishUrl = "https://bbs.hupu.com/newpost?tabkey=2";

function loggedOut(url: string) {
  return url.includes("passport.hupu.com");
}

function titleOf(body: string) {
  const title = postTitle(body, 40, "视频分享");
  return title.length >= 4 ? title : `${title}分享`.slice(0, 40);
}

export class HupuAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("hupu.com")) {
      await page.goto("https://www.hupu.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, "虎扑账号", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    const video = requireVideo(task, "虎扑");
    const page = await this.page();
    await page.goto(publishUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 虎扑");
    const upload = page.getByRole("button", { name: "上传视频" });
    await upload.waitFor({ state: "visible", timeout: 20000 });
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
    await upload.click();
    await (await chooser).setFiles(video);
    await replaceText(
      page,
      page.getByPlaceholder("请输入标题（最少4个字，最多40个字）"),
      titleOf(task.body),
    );
    if (task.body.trim()) {
      await replaceText(page, page.getByPlaceholder("请输入简介"), task.body.trim().slice(0, 500));
    }
    await waitUntil(
      page,
      async () => (await page.getByText("确定发布").count()) > 0,
      5 * 60 * 1000,
      "视频仍在上传，请稍后重试",
    );
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const button = page.getByLabel("发视频").getByText("确定发布");
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return /bbs\.hupu\.com\/\d+\.html/.test(page.url()) ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
