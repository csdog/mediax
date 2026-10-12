import type { AccountInfo } from "../../shared/models";
import { Database } from "../storage/Database";
import { AccountBrowserManager } from "../browser/AccountBrowserManager";
export class AccountService {
  private states = new Map<string, AccountInfo>();
  constructor(
    private db: Database,
    private browsers: AccountBrowserManager,
  ) {}
  list() {
    return this.db.accounts().map(
      (a) =>
        this.states.get(a.id) ?? {
          ...a,
          login: "unchecked" as const,
          targets: [],
        },
    );
  }
  add(name: string) {
    const a = this.db.addAccount(name);
    return { ...a, login: "unchecked" as const, targets: [] };
  }
  async open(id: string) {
    this.db.account(id);
    await this.browsers.open(id, "https://www.facebook.com/");
    this.browsers.show(id);
  }
  async refresh(id: string): Promise<AccountInfo> {
    const a = this.db.account(id),
      view = this.browsers.get(id);
    if (!view)
      return {
        ...a,
        login: "unchecked",
        targets: [],
        message: "请先打开账号浏览器并登录",
      };
    const url = view.webContents.getURL();
    const cookies = await view.webContents.session.cookies.get({
      url: "https://www.facebook.com",
    });
    const hasSession = cookies.some((c) => c.name === "c_user");
    // Cookie presence alone cannot establish the current publishing identity or Page permissions.
    const result: AccountInfo = {
      ...a,
      login: /checkpoint|two_step_verification/.test(url)
        ? "needs_verification"
        : hasSession
          ? "logged_in"
          : "logged_out",
      targets: [],
      message: hasSession
        ? "登录会话已检测；发布身份发现尚待真实页面验证，暂不开放发布"
        : "请在账号浏览器中完成登录",
    };
    this.states.set(id, result);
    return result;
  }
}
