import { app, dialog, nativeImage, session } from "electron";
import { writeFile } from "node:fs/promises";
import type { AccountInfo, BrowserBounds, PlatformId, Target } from "../../shared/models";
import { FacebookAdapter } from "../platforms/facebook/FacebookAdapter";
import { createPublisher } from "../platforms/registry";
import {
  hasPlatformSession,
  needsVerification,
  partitionName,
  platformCookieUrl,
  platformForUrl,
  platformHome,
  keepsClosedSession,
  sessionCookieNames,
  sessionOwner,
  urlLooksLoggedIn,
} from "../platforms/catalog";
import { platformInfo } from "../../shared/platforms";
import { bandwidthLimitBytesPerSecond, readPublishSettings } from "../../shared/publishSettings";
import { NeedsUser, type Publisher } from "../platforms/Publisher";
import { discoveredAccountName, shouldAdoptAccountName, usableAccountName } from "./accountName";
import { isCreatorPlatform, readCreatorProfile } from "./creatorProfile";
import { Database } from "../storage/Database";
import { AccountBrowserManager } from "../browser/AccountBrowserManager";
import type { BrowserHistoryStore } from "../browser/BrowserHistoryStore";

const logins = new Set<AccountInfo["login"]>([
  "unchecked",
  "logged_out",
  "logged_in",
  "needs_verification",
]);

export class AccountService {
  private states = new Map<string, AccountInfo>();
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private db: Database,
    private browsers: AccountBrowserManager,
    private browserHistory?: BrowserHistoryStore,
  ) {}
  async rememberBrowserVisit(
    viewAccountId: string,
    url: string,
    title: string,
    touch: boolean,
    icon?: string,
  ) {
    if (!this.browserHistory) return;
    const view = this.browsers.get(viewAccountId);
    const pageUrl =
      url.trim() || (view && !view.webContents.isDestroyed() ? view.webContents.getURL() : "");
    const resolved =
      view && !view.webContents.isDestroyed()
        ? await this.resolveHistoryAccount(viewAccountId, pageUrl, view.webContents.session)
        : null;
    this.browserHistory.remember(
      url,
      title,
      touch,
      icon,
      resolved?.id,
      resolved?.name,
      resolved?.avatar,
    );
  }
  setBrowserPageInteraction(handler: () => void) {
    this.browsers.setPageInteraction(handler);
  }
  list() {
    return this.db.accounts().map((account) => {
      const info = this.states.get(account.id) ?? this.stored(account.id);
      return this.adoptName(account.id, info);
    });
  }
  startAutoRefresh() {
    if (this.timer) return;
    // First sync is deferred slightly so cold start stays responsive.
    this.timer = setTimeout(() => {
      void this.syncAll();
      this.timer = setInterval(() => void this.syncAll(), 20_000);
    }, 2_000);
  }
  stopAutoRefresh() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    clearInterval(this.timer);
    this.timer = null;
  }
  add(name: string, platform: PlatformId = "facebook") {
    const a = this.db.addAccount(name, platform);
    return { ...a, login: "unchecked" as const, targets: [] };
  }
  async open(id: string, url?: string) {
    const account = this.db.account(id);
    const target =
      typeof url === "string" && url.trim() ? url.trim() : platformHome[account.platform];
    const view = await this.browsers.open(id, target, { platform: account.platform });
    if (!view.webContents || view.webContents.isDestroyed()) return;
    this.browsers.show(id);
    await this.syncStatus(id);
    await this.updateAvatar(id);
  }
  /** Open a plain webpage tab (not tied to an account session). */
  async openWeb(id: string, url: string) {
    if (!/^web-[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("无效网页标签");
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) throw new Error("无效网址");
    const view = await this.browsers.open(id, target, { partition: `persist:${id}` });
    if (!view.webContents || view.webContents.isDestroyed()) return;
    this.browsers.show(id);
  }
  private browserContents(id: string) {
    const view = this.browsers.get(id);
    if (!view || view.webContents.isDestroyed()) throw new Error("标签页已关闭");
    return view.webContents;
  }
  browserNavigation(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const contents = this.browserContents(id);
    const history = contents.navigationHistory;
    return {
      url: contents.getURL(),
      title: contents.getTitle(),
      canGoBack: history.canGoBack(),
      canGoForward: history.canGoForward(),
    };
  }
  async navigateBrowser(id: string, url: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) throw new Error("无效网址");
    await this.browserContents(id).loadURL(target);
    return this.browserNavigation(id);
  }
  async goBackBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const contents = this.browserContents(id);
    if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    return this.browserNavigation(id);
  }
  async goForwardBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const contents = this.browserContents(id);
    if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
    return this.browserNavigation(id);
  }
  async reloadBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    this.browserContents(id).reload();
    return this.browserNavigation(id);
  }
  browserZoom(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const factor = this.browserContents(id).getZoomFactor();
    return { factor, percent: Math.round(factor * 100) };
  }
  setBrowserZoom(id: string, factor: number) {
    if (!id.startsWith("web-")) this.db.account(id);
    const next = Math.min(3, Math.max(0.25, factor));
    this.browserContents(id).setZoomFactor(next);
    return this.browserZoom(id);
  }
  printBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    this.browserContents(id).print({});
  }
  findInBrowser(id: string, text: string, options?: { forward?: boolean; findNext?: boolean }) {
    if (!id.startsWith("web-")) this.db.account(id);
    const query = text.trim();
    if (!query) {
      this.browserContents(id).stopFindInPage("clearSelection");
      return { activeMatchOrdinal: 0, matches: 0 };
    }
    this.browserContents(id).findInPage(query, {
      forward: options?.forward !== false,
      findNext: Boolean(options?.findNext),
    });
    return { activeMatchOrdinal: 0, matches: 0 };
  }
  stopFindInBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    this.browserContents(id).stopFindInPage("clearSelection");
  }
  async screenshotBrowser(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const contents = this.browserContents(id);
    const image = await contents.capturePage();
    if (image.isEmpty()) throw new Error("截图失败");
    const host = (() => {
      try {
        return new URL(contents.getURL()).hostname || "page";
      } catch {
        return "page";
      }
    })();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const result = await dialog.showSaveDialog({
      title: "保存屏幕截图",
      defaultPath: `${app.getPath("downloads")}/${host}-${stamp}.png`,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, image.toPNG());
    return result.filePath;
  }
  async clearBrowserData(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    const contents = this.browserContents(id);
    await contents.session.clearStorageData();
    await contents.session.clearCache();
    contents.reload();
  }
  private async resolveHistoryAccount(
    viewAccountId: string,
    pageUrl: string,
    partition: Electron.Session,
  ) {
    const platform = viewAccountId.startsWith("web-")
      ? platformForUrl(pageUrl)
      : this.db.account(viewAccountId).platform;
    if (!platform) return null;
    const cookieUrl = platformCookieUrl[platform];
    const cookies = await partition.cookies.get({ url: cookieUrl });
    if (!hasPlatformSession(platform, cookies, pageUrl) && !urlLooksLoggedIn(platform, pageUrl)) {
      return null;
    }
    const owner =
      sessionOwner(platform, cookies, pageUrl) ??
      (urlLooksLoggedIn(platform, pageUrl) ? platform : null);
    if (!owner) return null;
    const matchedId = await this.matchAccountByCookies(platform, owner, cookies, cookieUrl);
    if (!matchedId) return null;
    const info = this.states.get(matchedId) ?? this.stored(matchedId);
    if (info.login !== "logged_in") return null;
    return {
      id: matchedId,
      name: info.name,
      avatar: info.avatar ?? this.cachedAvatar(matchedId)?.image,
    };
  }
  private async matchAccountByCookies(
    platform: PlatformId,
    owner: string,
    referenceCookies: Electron.Cookie[],
    cookieUrl: string,
  ) {
    const signature = this.sessionSignature(platform, referenceCookies);
    for (const account of this.db.accounts()) {
      if (account.platform !== platform) continue;
      const cookies = await session
        .fromPartition(partitionName(platform, account.id))
        .cookies.get({ url: cookieUrl });
      if (sessionOwner(platform, cookies) !== owner) continue;
      if (this.sessionSignature(platform, cookies) === signature) return account.id;
    }
    return null;
  }
  private sessionSignature(platform: PlatformId, cookies: Electron.Cookie[]) {
    const names = sessionCookieNames(platform);
    return names
      .map((name) => cookies.find((cookie) => cookie.name === name)?.value ?? "")
      .join("\0");
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
    const account = this.db.account(id);
    const view = this.browsers.get(id);
    if (!view || view.webContents.isDestroyed()) return this.cachedAvatar(id)?.image;
    try {
      const cookies = await view.webContents.session.cookies.get({
        url: platformCookieUrl[account.platform],
      });
      const pageUrl = view.webContents.getURL();
      const owner =
        sessionOwner(account.platform, cookies, pageUrl) ??
        (urlLooksLoggedIn(account.platform, pageUrl) ? account.platform : null);
      const actor =
        account.platform === "facebook"
          ? cookies.find((cookie) => cookie.name === "i_user")?.value || owner
          : owner;
      const cached = this.cachedAvatar(id);
      const previous =
        cached && cached.owner === owner && cached.actor === actor ? cached.image : undefined;
      if (!owner || (cached && !previous)) {
        this.db.setSetting(`avatar:${id}`, null);
        const state = this.states.get(id);
        if (state) this.states.set(id, { ...state, avatar: undefined });
      }
      if (!owner) return;
      const found = (await view.webContents.executeJavaScript(
        isCreatorPlatform(account.platform)
          ? `(${readCreatorProfile.toString()})(${JSON.stringify(account.platform)})`
          : avatarProbe,
      )) as {
        href?: string | null;
        rect?: { x: number; y: number; width: number; height: number } | null;
        name?: string | null;
      } | null;
      let image = previous;
      if (found?.href)
        image = (await this.downloadAvatar(view.webContents.session, found.href)) ?? image;
      if (image === previous && found?.rect) {
        const pixels = await view.webContents.capturePage(found.rect, {
          stayHidden: true,
          stayAwake: true,
        });
        if (!pixels.isEmpty())
          image = pixels.resize({ width: 80, height: 80, quality: "good" }).toDataURL();
      }
      if (image && image !== previous) this.db.setSetting(`avatar:${id}`, { owner, actor, image });
      const named = usableAccountName(account.platform, found?.name);
      if (
        named &&
        (isCreatorPlatform(account.platform) || shouldAdoptAccountName(account.name, named))
      )
        this.db.renameAccount(id, named);
      const state = this.states.get(id);
      if (state)
        this.states.set(id, {
          ...state,
          avatar: image,
          name:
            named &&
            (isCreatorPlatform(account.platform) || shouldAdoptAccountName(state.name, named))
              ? named
              : state.name,
        });
      return image;
    } catch {
      return this.cachedAvatar(id)?.image;
    }
  }
  private async downloadAvatar(partition: Electron.Session, href: string) {
    try {
      const response = await partition.fetch(href);
      if (!response.ok) return null;
      const type = response.headers.get("content-type") ?? "";
      if (type && !type.startsWith("image/")) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 2_000_000) return null;
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) return null;
      return image.resize({ width: 80, height: 80, quality: "good" }).toDataURL();
    } catch {
      return null;
    }
  }
  async preview(id: string) {
    const view = this.browsers.get(id);
    if (!view || view.webContents.isDestroyed()) throw new Error("标签页已关闭");
    const contents = view.webContents;
    const url = contents.getURL();
    let hostname = "";
    try {
      hostname = url ? new URL(url).hostname : "";
    } catch {
      hostname = "";
    }
    if (!hostname && !id.startsWith("web-")) {
      const account = this.db.account(id);
      hostname = platformHost(account.platform);
    }
    const screenshot = await contents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    return {
      title: contents.getTitle(),
      hostname,
      image: screenshot.isEmpty()
        ? null
        : screenshot
            .resize({ width: Math.min(1280, screenshot.getSize().width), quality: "good" })
            .toDataURL(),
    };
  }
  layout(id: string | null, bounds?: BrowserBounds) {
    if (id !== null && !id.startsWith("web-")) this.db.account(id);
    this.browsers.setLayout(id, bounds);
  }
  close(id: string) {
    if (!id.startsWith("web-")) this.db.account(id);
    this.browsers.close(id);
  }
  async remove(id: string) {
    if (this.operating) throw new Error("账号正在执行身份检查或发布任务，请稍后再试");
    const account = this.db.account(id);
    this.db.deleteAccount(id);
    this.states.delete(id);
    this.browsers.close(id);
    if (!app?.isReady()) return;
    const partition = session.fromPartition(partitionName(account.platform, id));
    await partition.clearStorageData();
    await partition.clearCache();
  }
  /** Close account browsers and wipe persist partition storage (login state). */
  async clearAllBrowserSessions() {
    if (this.operating) throw new Error("账号正在执行身份检查或发布任务，请稍后再试");
    for (const account of this.db.accounts()) {
      this.browsers.close(account.id);
      if (app?.isReady()) {
        const partition = session.fromPartition(partitionName(account.platform, account.id));
        await partition.clearStorageData();
        await partition.clearCache();
      }
      const previous = this.states.get(account.id) ?? this.stored(account.id);
      this.remember({
        ...previous,
        login: "logged_out",
        message: "已清理浏览器会话，请重新登录",
      });
    }
  }
  applyBandwidthLimit(
    kbps = readPublishSettings((key) => this.db.setting(key)).bandwidthLimitKbps,
  ) {
    if (!app?.isReady()) return;
    const bytes = bandwidthLimitBytesPerSecond(kbps);
    for (const account of this.db.accounts()) {
      const partition = session.fromPartition(partitionName(account.platform, account.id));
      if (bytes <= 0) partition.disableNetworkEmulation();
      else
        partition.enableNetworkEmulation({
          offline: false,
          latency: 0,
          downloadThroughput: bytes,
          uploadThroughput: bytes,
        });
    }
  }
  private async sessionPage(id: string) {
    const account = this.db.account(id);
    const settings = readPublishSettings((key) => this.db.setting(key));
    if (!this.browsers.get(id))
      await this.browsers.open(id, platformHome[account.platform], {
        focus: !settings.silent,
        platform: account.platform,
      });
    const view = this.browsers.get(id);
    if (settings.silent && view && !view.webContents.isDestroyed())
      view.webContents.setBackgroundThrottling(false);
    this.applyBandwidthLimit(settings.bandwidthLimitKbps);
    return this.browsers.page(id);
  }
  adapter(id: string): Publisher & { discover(accountId: string): Promise<Target[]> } {
    const account = this.db.account(id);
    const openPage = () => this.sessionPage(id);
    if (account.platform !== "facebook") return createPublisher(account.platform, openPage);
    return new FacebookAdapter(
      openPage,
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
    return this.exclusive(async () => {
      const account = this.db.account(id);
      const existing = this.browsers.get(id);
      if (!existing || existing.webContents.isDestroyed()) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const view = await Promise.race([
            this.browsers.open(id, platformHome[account.platform], {
              platform: account.platform,
              focus: false,
              waitUntil: "dom-ready",
            }),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                reject(new Error("账号页面加载超时，请打开账号浏览器确认网络后重试"));
              }, 15_000);
            }),
          ]);
          if (!view.webContents || view.webContents.isDestroyed())
            throw new Error("账号检查已取消，请重新检查");
        } finally {
          clearTimeout(timeout);
        }
      }
      return this.inspect(id);
    });
  }
  private async inspect(id: string): Promise<AccountInfo> {
    const a = this.db.account(id),
      view = this.browsers.get(id);
    if (!view) {
      const current = this.states.get(id) ?? this.stored(id);
      return {
        ...current,
        message: current.login === "unchecked" ? "请先打开账号浏览器并登录" : current.message,
      };
    }
    if (a.platform === "channels" && view.webContents.isLoadingMainFrame())
      return this.states.get(id) ?? this.stored(id);
    const url = view.webContents.getURL();
    const cookies = await view.webContents.session.cookies.get({
      url: platformCookieUrl[a.platform],
    });
    const hasSession =
      hasPlatformSession(a.platform, cookies, url) || urlLooksLoggedIn(a.platform, url);
    const result: AccountInfo = {
      ...a,
      avatar: await this.updateAvatar(id),
      login: needsVerification(a.platform, url)
        ? "needs_verification"
        : hasSession
          ? "logged_in"
          : "logged_out",
      targets: (this.states.get(id) ?? this.stored(id)).targets,
      message: loginPrompt(a.platform),
    };
    result.name = this.db.account(id).name;
    if (result.login === "logged_in") {
      try {
        const found = await this.adapter(id).discover(id);
        const saved = this.db.setting(`identities:${id}`) as {
          owner?: string;
          targets?: AccountInfo["targets"];
        } | null;
        const owner =
          sessionOwner(a.platform, cookies, url) ??
          (urlLooksLoggedIn(a.platform, url) ? a.platform : null);
        const retained = saved && saved.owner === owner ? (saved.targets ?? []) : [];
        const targets = new Map(retained.map((t) => [t.identityId, t]));
        for (const t of found) targets.set(t.identityId, t);
        result.targets = [...targets.values()];
        this.db.setSetting(`identities:${id}`, { owner, targets: result.targets });
        result.message = discoveredMessage(a.platform, result.targets);
      } catch (error) {
        result.message = error instanceof Error ? error.message : String(error);
        if (!(error instanceof NeedsUser)) result.message = `身份检查失败：${result.message}`;
      }
      result.avatar = (await this.updateAvatar(id)) ?? result.avatar;
      result.name = this.db.account(id).name;
      Object.assign(result, this.adoptName(id, result));
    } else if (result.login === "needs_verification")
      result.message =
        a.platform === "facebook"
          ? "请在 Facebook 完成安全验证后重新检查"
          : "请在账号浏览器中完成安全验证后重新检查";
    this.remember(result);
    return result;
  }
  private adoptName(id: string, info: AccountInfo) {
    const discovered = discoveredAccountName(info.platform, info.targets);
    const cleaned = usableAccountName(info.platform, info.name);
    const name = discovered ?? (cleaned && cleaned !== info.name ? cleaned : null);
    if (!name || name === info.name) return info;
    this.db.renameAccount(id, name);
    const renamed = { ...info, name };
    this.states.set(id, renamed);
    return renamed;
  }
  private stored(id: string): AccountInfo {
    const account = this.db.account(id);
    const status = this.readStatus(id);
    const identities = this.readIdentities(id);
    const targets = status?.targets.length ? status.targets : (identities?.targets ?? []);
    return {
      ...account,
      avatar: this.cachedAvatar(id)?.image,
      login: status?.login ?? (targets.length ? "logged_in" : "unchecked"),
      targets,
      message: status?.message,
    };
  }
  private readStatus(
    id: string,
  ): { login: AccountInfo["login"]; message?: string; targets: Target[] } | null {
    const value = this.db.setting(`account-status:${id}`) as {
      login?: AccountInfo["login"];
      message?: unknown;
      targets?: Target[];
    } | null;
    if (!value || !value.login || !logins.has(value.login)) return null;
    return {
      login: value.login,
      message: typeof value.message === "string" ? value.message : undefined,
      targets: this.targetsOf(id, value.targets),
    };
  }
  private readIdentities(id: string) {
    const saved = this.db.setting(`identities:${id}`) as {
      owner?: string;
      targets?: Target[];
    } | null;
    if (!saved || typeof saved.owner !== "string") return null;
    return { owner: saved.owner, targets: this.targetsOf(id, saved.targets) };
  }
  private targetsOf(id: string, value: Target[] | undefined): Target[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (target) =>
        target &&
        target.accountId === id &&
        typeof target.identityId === "string" &&
        typeof target.name === "string" &&
        (target.kind === "profile" || target.kind === "page"),
    );
  }
  private remember(account: AccountInfo) {
    this.states.set(account.id, account);
    this.db.setSetting(`account-status:${account.id}`, {
      login: account.login,
      message: account.message ?? null,
      targets: account.targets,
    });
  }
  private async syncAll() {
    if (this.operating) return;
    for (const account of this.db.accounts()) {
      try {
        await this.syncStatus(account.id);
      } catch {
        // Keep the last persisted status when a session cannot be read.
      }
    }
  }
  private async syncStatus(id: string) {
    const account = this.db.account(id);
    const view = this.browsers.get(id);
    if (
      account.platform === "channels" &&
      view &&
      !view.webContents.isDestroyed() &&
      view.webContents.isLoadingMainFrame()
    )
      return;
    const partition =
      view && !view.webContents.isDestroyed()
        ? view.webContents.session
        : session.fromPartition(partitionName(account.platform, id));
    const cookies = await partition.cookies.get({ url: platformCookieUrl[account.platform] });
    const url = view && !view.webContents.isDestroyed() ? view.webContents.getURL() : "";
    const closedLoggedIn =
      !url &&
      keepsClosedSession(account.platform) &&
      (this.states.get(id) ?? this.stored(id)).login === "logged_in";
    const previous = this.states.get(id) ?? this.stored(id);
    const owner =
      account.platform === "channels" && !url && previous.login !== "logged_in"
        ? null
        : (sessionOwner(account.platform, cookies, url) ??
          (urlLooksLoggedIn(account.platform, url) || closedLoggedIn ? account.platform : null));
    let login: AccountInfo["login"];
    let message = previous.message;
    if (needsVerification(account.platform, url)) {
      login = "needs_verification";
      message =
        account.platform === "facebook"
          ? "请在 Facebook 完成安全验证后重新检查"
          : "请在账号浏览器中完成安全验证后重新检查";
    } else if (owner || urlLooksLoggedIn(account.platform, url)) login = "logged_in";
    else if (closedLoggedIn) login = "logged_in";
    else login = "logged_out";
    if (login === "logged_out") message = loginPrompt(account.platform);
    const identities = this.readIdentities(id);
    const discovered =
      login === "logged_in" && identities && identities.owner === owner ? identities.targets : [];
    const targets = login === "logged_in" ? discovered : previous.targets;
    if (login === "logged_in" && previous.login !== "logged_in")
      message = targets.length
        ? `已识别 ${targets.length} 个发布身份。`
        : "已登录。打开账号后可检查发布身份。";
    const sameTargets =
      previous.targets.length === targets.length &&
      previous.targets.every((target, index) => target.identityId === targets[index]?.identityId);
    if (previous.login === login && previous.message === message && sameTargets) return;
    this.remember({
      ...previous,
      login,
      targets,
      message,
      avatar: this.cachedAvatar(id)?.image ?? previous.avatar,
    });
  }
}

function platformHost(platform: PlatformId) {
  return platformInfo[platform].label;
}

function loginPrompt(platform: PlatformId) {
  if (platform === "facebook") return "请在账号标签页中完成登录";
  if (platform === "youtube") return "请在账号标签页中登录 Google / YouTube";
  return `请在账号标签页中登录 ${platformInfo[platform].label}`;
}

const avatarProbe = `(() => {
  const hrefOf = (image) => {
    const raw = image.currentSrc || image.src || image.getAttribute("href") || "";
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.href;
    } catch {
      return null;
    }
  };
  const rectOf = (image) => {
    const tag = image.tagName.toLowerCase();
    if (tag === "img" && (!image.complete || !image.naturalWidth)) return null;
    const r = image.getBoundingClientRect();
    if (
      r.width < 16 || r.height < 16 || r.width > 160 || r.height > 160 ||
      r.x < 0 || r.y < 0 || r.right > innerWidth || r.bottom > innerHeight
    ) return null;
    return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  };
  const nameOf = (image) => {
    let alt = (image.getAttribute("alt") || "").trim();
    const wrapped = alt.match(/^(?:点击)?(?:打开|进入)(.+?)的(?:个人)?主页$/);
    if (wrapped) alt = wrapped[1].trim();
    if (!alt || alt.length > 40) return null;
    if (/avatar|头像|logo|icon|profile|账号|账户|帐户|个人主页/i.test(alt)) return null;
    return alt;
  };
  const pack = (image) => {
    const href = hrefOf(image);
    const rect = rectOf(image);
    const name = nameOf(image);
    return href || rect || name ? { href, rect, name } : null;
  };
  const menu = [...document.querySelectorAll('[role="button"],button')].find((el) =>
    /^(Account|Your profile|你的个人主页|账户|帐户|账号)$/i.test(el.getAttribute("aria-label") || "") &&
    el.getBoundingClientRect().width > 0);
  if (menu) {
    for (const image of menu.querySelectorAll("img,svg image")) {
      const found = pack(image);
      if (found) return found;
    }
    return null;
  }
  for (const image of document.querySelectorAll("img")) {
    const text = [image.alt, image.getAttribute("aria-label") || "", image.className, image.getAttribute("src") || ""].join(" ");
    if (!/avatar|头像|portrait/i.test(text)) continue;
    const found = pack(image);
    if (found) return found;
  }
  for (const el of document.querySelectorAll("[class*='avatar'],[class*='Avatar']")) {
    const match = /url\\((['"]?)(https?:\\/\\/[^'")]+)\\1\\)/.exec(getComputedStyle(el).backgroundImage || "");
    if (!match) continue;
    const rect = rectOf(el);
    return { href: match[2], rect };
  }
  return null;
})()`;

function discoveredMessage(platform: PlatformId, targets: Target[]) {
  if (platform === "youtube")
    return targets.length
      ? `已识别频道「${targets[0]?.name}」。发布时请附上视频。`
      : "已登录，但没有找到频道。请打开 YouTube Studio 后再次检查。";
  if (platform === "tiktok")
    return targets.length
      ? `已识别 ${targets[0]?.name}。发布时请附上视频。`
      : "已登录，但没有读到账号。请打开 TikTok 后再次检查。";
  if (platform === "reddit")
    return targets.length
      ? `已识别 ${targets[0]?.name}。文字帖会发到这个个人主页。`
      : "已登录，但没有读到用户名。请打开 Reddit 后再次检查。";
  if (platform === "facebook")
    return `已识别 ${targets.length} 个发布身份。若需添加其他公共主页，请在 Facebook 切换到该主页后再次检查状态。`;
  return targets.length
    ? `已识别 ${targets[0]?.name}。`
    : `已登录，但没有读到账号。请打开 ${platformInfo[platform].label} 后再次检查。`;
}
