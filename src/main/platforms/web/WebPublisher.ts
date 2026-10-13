import type { Page } from "playwright-core";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { ContentKind, PlatformId, Target, Task, TaskTarget } from "../../../shared/models";
import { discoverProfile } from "../form";
import { editorFiles, openKindEditor, submitKindEditor } from "../editor";
import { NeedsUser, type Publisher } from "../Publisher";

export type WebFlow = {
  platform: PlatformId;
  label: string;
  home: string;
  loggedOut: (url: string) => boolean;
  urls: Partial<Record<ContentKind, string>>;
};

export class WebPublisher implements Publisher {
  constructor(
    private readonly page: () => Promise<Page>,
    private readonly flow: WebFlow,
  ) {}

  supportedKinds() {
    return platformKinds(this.flow.platform);
  }

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (!page.url().includes(new URL(this.flow.home).hostname)) {
      await page.goto(this.flow.home, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    return discoverProfile(page, accountId, this.flow.label, this.flow.loggedOut);
  }

  async prepare(task: Task, _target: TaskTarget) {
    if (!this.supportedKinds().includes(task.contentKind))
      throw new NeedsUser(`${this.flow.label}不支持这种内容`);
    const page = await this.page();
    await openKindEditor(page, task, {
      url: this.flow.urls[task.contentKind] ?? this.flow.home,
      loggedOut: this.flow.loggedOut,
      hint: `请先在账号浏览器中登录 ${this.flow.label}`,
      files: editorFiles(task.contentKind),
    });
  }

  async submit(_task: Task, _target: TaskTarget, markSubmitted: () => void) {
    await submitKindEditor(await this.page(), markSubmitted);
  }

  async verify(): Promise<string | null> {
    return null;
  }

  async verifyExisting(): Promise<string | null> {
    return null;
  }
}
