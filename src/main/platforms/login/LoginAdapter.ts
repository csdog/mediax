import type { Page } from "playwright-core";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, type Publisher } from "../Publisher";

const loginPage = /login|signin|passport|userAuth/i;

export class LoginAdapter implements Publisher {
  constructor(
    private readonly page: () => Promise<Page>,
    private readonly label: string,
  ) {}

  async discover(accountId: string): Promise<Target[]> {
    const page = await this.page();
    if (loginPage.test(page.url())) return [];
    return [{ accountId, identityId: "account", name: this.label, kind: "profile" }];
  }

  async prepare(): Promise<void> {
    throw new NeedsUser(`${this.label} 已打开登录页。发布流程还在接入，完成登录后可先检查状态。`);
  }

  async submit(_task: Task, _target: TaskTarget, _markSubmitted: () => void): Promise<void> {
    throw new NeedsUser(`${this.label} 的发布流程还在接入`);
  }

  async verify(): Promise<string | null> {
    return null;
  }

  async verifyExisting(): Promise<string | null> {
    return null;
  }
}
