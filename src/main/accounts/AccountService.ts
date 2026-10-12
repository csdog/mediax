import type { AccountInfo, BrowserBounds } from "../../shared/models";
import { FacebookAdapter } from "../platforms/facebook/FacebookAdapter";
import { NeedsUser } from "../platforms/Publisher";
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
          avatar: this.cachedAvatar(a.id)?.image,
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
    await this.updateAvatar(id);
  }
  private cachedAvatar(id: string) {
    const value = this.db.setting(`avatar:${id}`) as {
      owner?: string;
      actor?: string;
      image?: string;
    } | null;
    return value &&
      typeof value.image === "string" &&
      value.image.startsWith("data:image/png;base64,")
      ? value
      : null;
  }
  private async updateAvatar(id: string): Promise<string | undefined> {
    const view = this.browsers.get(id);
    if (!view || view.webContents.isDestroyed()) return this.cachedAvatar(id)?.image;
    try {
      const cookies = await view.webContents.session.cookies.get({
        url: "https://www.facebook.com",
      });
      const owner = cookies.find((cookie) => cookie.name === "c_user")?.value;
      const actor = cookies.find((cookie) => cookie.name === "i_user")?.value || owner;
      const cached = this.cachedAvatar(id);
      const previous =
        cached && cached.owner === owner && cached.actor === actor ? cached.image : undefined;
      if (!owner || (cached && !previous)) {
        this.db.setSetting(`avatar:${id}`, null);
        const state = this.states.get(id);
        if (state) this.states.set(id, { ...state, avatar: undefined });
      }
      if (!owner) return;
      // Capture only the current account menu's loaded image, never feed/user pictures.
      // Local pixels avoid exposing the account's CDN URL or cookies to the renderer.
      const rect = await view.webContents.executeJavaScript(`(() => {
        const button = [...document.querySelectorAll('[role="button"],button')].find((el) =>
          /^(Account|Your profile|你的个人主页|账户|帐户|账号)$/i.test(el.getAttribute('aria-label') || '') && el.getBoundingClientRect().width > 0);
        if (!button) return null;
        for (const image of button.querySelectorAll('img,svg image')) {
          if (image.tagName.toLowerCase() === 'img' && (!image.complete || !image.naturalWidth)) continue;
          const r = image.getBoundingClientRect();
          if (r.width < 16 || r.height < 16 || r.width > 160 || r.height > 160 || r.x < 0 || r.y < 0 || r.right > innerWidth || r.bottom > innerHeight) continue;
          return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
        }
        return null;
      })()`);
      let image = previous;
      if (rect) {
        const pixels = await view.webContents.capturePage(rect, {
          stayHidden: true,
          stayAwake: true,
        });
        if (!pixels.isEmpty()) {
          image = pixels.resize({ width: 80, height: 80, quality: "good" }).toDataURL();
          this.db.setSetting(`avatar:${id}`, { owner, actor, image });
        }
      }
      const state = this.states.get(id);
      if (state) this.states.set(id, { ...state, avatar: image });
      return image;
    } catch {
      return this.cachedAvatar(id)?.image;
    }
  }
  async preview(id: string) {
    this.db.account(id);
    const view = this.browsers.get(id);
    if (!view || view.webContents.isDestroyed()) throw new Error("账号标签页已关闭");
    const contents = view.webContents;
    const url = contents.getURL();
    const screenshot = await contents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    return {
      title: contents.getTitle(),
      hostname: url ? new URL(url).hostname : "Facebook",
      image: screenshot.isEmpty()
        ? null
        : screenshot
            .resize({ width: Math.min(1280, screenshot.getSize().width), quality: "good" })
            .toDataURL(),
    };
  }
  layout(id: string | null, bounds?: BrowserBounds) {
    if (id !== null) this.db.account(id);
    this.browsers.setLayout(id, bounds);
  }
  close(id: string) {
    this.db.account(id);
    this.browsers.close(id);
  }
  adapter(id: string) {
    this.db.account(id);
    return new FacebookAdapter(
      async () => {
        if (!this.browsers.get(id)) await this.browsers.open(id, "https://www.facebook.com/");
        return this.browsers.page(id);
      },
      async () => {
        const view = this.browsers.get(id);
        if (!view) return { owner: null, actor: null };
        const cookies = await view.webContents.session.cookies.get({
          url: "https://www.facebook.com",
        });
        const value = (name: string) =>
          cookies.find((cookie) => cookie.name === name)?.value ?? null;
        return { owner: value("c_user"), actor: value("i_user") };
      },
      {
        save: (targetId, evidence) => this.db.setSetting(`publish-evidence:${targetId}`, evidence),
        load: (targetId) =>
          this.db.setting(`publish-evidence:${targetId}`) as {
            before: string[];
            candidate?: string;
            authorPath: string | null;
          } | null,
      },
    );
  }
  private operating = false;
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.operating) throw new Error("账号正在执行身份检查或发布任务，请稍后再试");
    this.operating = true;
    try {
      return await work();
    } finally {
      this.operating = false;
    }
  }
  async refresh(id: string): Promise<AccountInfo> {
    return this.exclusive(() => this.inspect(id));
  }
  private async inspect(id: string): Promise<AccountInfo> {
    const a = this.db.account(id),
      view = this.browsers.get(id);
    if (!view)
      return {
        ...a,
        avatar: this.cachedAvatar(id)?.image,
        login: "unchecked",
        targets: [],
        message: "请先打开账号浏览器并登录",
      };
    const url = view.webContents.getURL();
    const cookies = await view.webContents.session.cookies.get({
      url: "https://www.facebook.com",
    });
    const hasSession = cookies.some((c) => c.name === "c_user");
    const result: AccountInfo = {
      ...a,
      avatar: await this.updateAvatar(id),
      login: /checkpoint|two_step_verification/.test(url)
        ? "needs_verification"
        : hasSession
          ? "logged_in"
          : "logged_out",
      targets: [],
      message: "请在账号标签页中完成登录",
    };
    if (result.login === "logged_in") {
      try {
        const found = await this.adapter(id).discover(id);
        const saved = this.db.setting(`identities:${id}`) as {
          owner?: string;
          targets?: AccountInfo["targets"];
        } | null;
        const owner = cookies.find((cookie) => cookie.name === "c_user")?.value;
        const retained = saved && saved.owner === owner ? (saved.targets ?? []) : [];
        const targets = new Map(retained.map((t) => [t.identityId, t]));
        for (const t of found) targets.set(t.identityId, t);
        result.targets = [...targets.values()];
        this.db.setSetting(`identities:${id}`, { owner, targets: result.targets });
        result.message = `已识别 ${result.targets.length} 个发布身份。若需添加其他公共主页，请在 Facebook 切换到该主页后再次检查状态。`;
      } catch (error) {
        result.message = error instanceof Error ? error.message : String(error);
        if (!(error instanceof NeedsUser)) result.message = `身份检查失败：${result.message}`;
      }
    } else if (result.login === "needs_verification")
      result.message = "请在 Facebook 完成安全验证后重新检查";
    this.states.set(id, result);
    return result;
  }
}
