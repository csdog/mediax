import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";
import { discoverProfile, photos, selectAll, waitUntil } from "../form";
import { isVideo } from "../postText";

const uploadUrl = "https://cp.kuaishou.com/article/publish/video";

function loggedOut(url: string) {
  return /login|passport/i.test(url) || !url.includes("cp.kuaishou.com");
}

async function focusDescription(page: Page) {
  const label = page.getByText("描述");
  const box = label.locator("xpath=following::*[@contenteditable='true'][1]").first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.click();
  await page.keyboard.press(selectAll());
  await page.keyboard.press("Delete");
}

export class KuaishouAdapter implements Publisher {
  constructor(private readonly page: () => Promise<Page>) {}

  supportedKinds() {
    return platformKinds("kuaishou");
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes("cp.kuaishou.com")) {
      await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, "快手账号", loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    const video = task.contentKind === "moment" ? undefined : task.images.find(isVideo);
    if (task.contentKind === "video" && !video)
      throw new NeedsUser("快手需要一段视频，请附上视频后再发布");
    const images = photos(task);
    if (!video && !images.length) throw new NeedsUser("快手需要一段视频或图片，请附上素材后再发布");
    const page = await this.page();
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (loggedOut(page.url())) throw new NeedsUser("请先在账号浏览器中登录 快手");
    const button = page
      .locator("button[class^='_upload-btn']")
      .filter(video ? { hasNotText: "上传图片" } : { hasText: "上传图片" })
      .first();
    await button.waitFor({ state: "visible", timeout: 20000 });
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
    await button.click();
    await (await chooser).setFiles(video ? video : images);
    const know = page.locator('button[type="button"] span:text("我知道了")').first();
    if (await know.count()) await know.click().catch(() => {});
    await focusDescription(page);
    await page.keyboard.insertText((task.body.trim() || "未命名").slice(0, 500));
    await waitUntil(
      page,
      async () => (await page.getByText("上传中").count()) === 0,
      5 * 60 * 1000,
      "素材仍在上传，请稍后重试",
    );
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    const page = await this.page();
    const confirm = page
      .locator("div.ant-modal-confirm-centered:visible button.ant-btn-primary")
      .first();
    const button = (await confirm.count())
      ? confirm
      : page.getByText("发布", { exact: true }).first();
    await button.waitFor({ state: "visible", timeout: 15000 });
    markSubmitted();
    await button.click();
    const again = page.getByText("确认发布").first();
    if (await again.count()) await again.click().catch(() => {});
  }

  async verify(): Promise<string | null> {
    const page = await this.page();
    return page.url().includes("/article/manage/") ? page.url() : null;
  }

  async verifyExisting(): Promise<string | null> {
    return this.verify();
  }
}
