import type { Page, Locator } from "playwright-core";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { supportedKinds as platformKinds } from "../../../shared/content";
import type { Target, Task, TaskTarget } from "../../../shared/models";
import { NeedsUser, NotSubmitted, type Publisher } from "../Publisher";
import { labels } from "./selectors";

type SessionIdentity = { owner: string | null; actor: string | null };
type Identity = { id: string; name: string; kind: "profile" | "page" };
const normal = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
// Photo posts move to a settings step whose preview keeps the body, while the
// original textbox stays in the DOM off-screen and empty.
export function composerStillHasPost(
  editorText: string | null,
  surfaceText: string,
  expected: string,
) {
  const want = normal(expected);
  if (!want) return false;
  if (editorText !== null && normal(editorText) === want) return true;
  const surface = normal(surfaceText);
  if (surface.includes(want)) return true;
  const compact = (value: string) => value.replace(/\s+/g, "");
  return compact(surface).includes(compact(want));
}
const isVideo = (path: string) =>
  [".mp4", ".mov", ".m4v", ".webm"].includes(extname(path).toLowerCase());
export function postUrl(href: string): string | null {
  try {
    const u = new URL(href, "https://www.facebook.com");
    if (u.protocol !== "https:" || !["www.facebook.com", "facebook.com"].includes(u.hostname))
      return null;
    if (
      !(
        /^\/[^/]+\/posts\/[^/]+\/?$/.test(u.pathname) ||
        (u.pathname === "/permalink.php" &&
          u.searchParams.has("story_fbid") &&
          u.searchParams.has("id"))
      )
    )
      return null;
    const clean = new URL(u.origin + u.pathname);
    for (const key of ["story_fbid", "id"]) {
      const value = u.searchParams.get(key);
      if (value) clean.searchParams.set(key, value);
    }
    return clean.href;
  } catch {
    return null;
  }
}
export class FacebookAdapter implements Publisher {
  supportedKinds() {
    return platformKinds("facebook");
  }

  private authorPath: string | null = null;
  private prepared?: { taskId: string; targetId: string; before: Set<string> };
  constructor(
    private getPage: () => Promise<Page>,
    private sessionIdentity: () => Promise<SessionIdentity>,
    private journal?: {
      save: (
        targetId: string,
        evidence: { before: string[]; candidate?: string; authorPath: string | null },
      ) => void;
      load: (
        targetId: string,
      ) => { before: string[]; candidate?: string; authorPath: string | null } | null;
    },
  ) {}
  private async ready(page: Page) {
    const url = new URL(page.url());
    if (url.protocol !== "https:" || !["www.facebook.com", "facebook.com"].includes(url.hostname))
      throw new NeedsUser("请在账号标签页打开 Facebook");
    if (/checkpoint|two_step_verification|\/login|\/recover/.test(url.pathname))
      throw new NeedsUser("请在账号标签页完成登录或安全验证，再点击继续");
    if (await page.locator('input[name="email"], input[name="pass"]').count())
      throw new NeedsUser("登录已失效，请在账号标签页重新登录");
    const session = await this.sessionIdentity();
    if (!session.owner) throw new NeedsUser("请先登录 Facebook");
    return session;
  }
  // Identity IDs come from the loaded Facebook actor bootstrap, not display-name matching.
  async identity(page: Page): Promise<Identity> {
    const session = await this.ready(page);
    const evidence = await page.evaluate(() => {
      const scripts = [...document.scripts].map((s) => s.textContent ?? "").join("\n");
      const actors = [
        ...new Set([...scripts.matchAll(/"actorID"\s*:\s*"(\d+)"/g)].map((m) => m[1])),
      ];
      const user = scripts.match(/"USER_ID"\s*:\s*"(\d+)"/);
      const name = scripts.match(/"NAME"\s*:\s*("(?:[^"\\]|\\.)*")/);
      return {
        actors,
        user: user?.[1],
        name: name ? (JSON.parse(name[1]) as string) : "",
      };
    });
    const expected = session.actor || session.owner!;
    if (evidence.actors.length !== 1 || evidence.actors[0] !== expected)
      throw new NeedsUser(
        `无法唯一核验当前发布身份（页面 ${evidence.actors.join(",") || "未加载"}，会话 ${expected}），请等待主页加载完成后重新检查`,
      );
    const kind = expected === session.owner ? "profile" : "page";
    const name = evidence.user === expected ? evidence.name : "";
    if (!name)
      throw new NeedsUser("已检测身份 ID，但尚未识别主页名称，请打开当前身份的主页后重新检查");
    return { id: expected, name, kind };
  }
  private async profileChoices(page: Page) {
    if (await this.dialog(page).count())
      throw new NeedsUser("请先保存或关闭 Facebook 编辑器，再检查或切换发布身份");
    const button = await this.unique(
      page.getByRole("button", { name: labels.account }),
      "未找到身份菜单，请打开 Facebook 首页",
    );
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    const all = page.getByRole("button", { name: labels.profiles }).filter({ visible: true });
    if ((await all.count()) === 1) {
      await all.click();
      await page
        .getByRole("heading", { name: /^(选择主页|Choose profile|Select profile)$/i })
        .waitFor({ timeout: 10000 });
    }
    return page.getByRole("dialog", { name: labels.account }).filter({ visible: true });
  }
  private choice(page: Page, name: string) {
    const escape = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return page
      .getByRole("dialog", { name: labels.account })
      .getByRole("listitem")
      .getByRole("button", {
        name: new RegExp(`^(?:切换到|Switch to )?${escape}(?:[，,].*)?$`, "i"),
      })
      .filter({ visible: true });
  }
  private async switchName(page: Page, name: string, previous: string) {
    await this.profileChoices(page);
    await (
      await this.unique(this.choice(page, name), "目标身份存在同名或无法唯一选择，请手动切换后继续")
    ).click();
    for (let i = 0; i < 30; i++) {
      const session = await this.sessionIdentity();
      if ((session.actor || session.owner) !== previous) break;
      await page.waitForTimeout(200);
    }
    // Reload after the actor changes to avoid stale bootstrap data from SPA navigation.
    await this.navigate(page, "https://www.facebook.com/");
    return this.identity(page);
  }
  async discover(accountId: string): Promise<Target[]> {
    const page = await this.getPage();
    const original = await this.identity(page);
    const found = new Map<string, Identity>([[original.id, original]]);
    const account = page.getByRole("button", { name: labels.account }).filter({ visible: true });
    await account.waitFor({ timeout: 3000 }).catch(() => {});
    if ((await account.count()) === 1) {
      const choices = await this.profileChoices(page);
      const names = await choices
        .getByRole("listitem")
        .getByRole("button")
        .filter({ visible: true })
        .evaluateAll((nodes) =>
          nodes
            // Profile rows have an avatar. The same list also contains actions such
            // as Create Page, which must never be clicked during identity discovery.
            .filter((node) => node.querySelector("img, svg image"))
            .map((node) =>
              (node.getAttribute("aria-label") || node.textContent || "")
                .replace(/^(?:切换到|Switch to )/, "")
                .replace(/(?:，|,).*$/, "")
                .trim(),
            ),
        );
      await page.keyboard.press("Escape");
      let current = original;
      let discoveryError: unknown;
      try {
        for (const name of [...new Set(names)].slice(0, 20)) {
          if (!name || name === original.name) continue;
          current = await this.switchName(page, name, current.id);
          if (current.name !== name || current.id === original.id)
            throw new NeedsUser("身份菜单与切换结果不一致，请手动检查账号");
          found.set(current.id, current);
        }
      } catch (error) {
        discoveryError = error;
      }
      {
        if (current.id !== original.id) {
          const restored = await this.switchName(page, original.name, current.id);
          if (restored.id !== original.id)
            throw new NeedsUser("未能恢复原身份，请在 Facebook 手动切换后重新检查");
        }
      }
      if (discoveryError) throw discoveryError;
    }
    return [...found.values()].map((identity) => ({
      accountId,
      identityId: identity.id,
      name: identity.name,
      kind: identity.kind,
    }));
  }
  private async navigate(page: Page, url: string) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      // Facebook can still be completing its own redirect. Retry only read-only
      // navigation once; publishing clicks are never retried by this helper.
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.goto(url, { waitUntil: "domcontentloaded" });
    }
  }
  private async unique(locator: Locator, message: string) {
    const visible = locator.filter({ visible: true });
    await visible
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {
        throw new NeedsUser(message);
      });
    if ((await visible.count()) !== 1) throw new NeedsUser(message);
    return visible;
  }
  async selectTarget(page: Page, target: Target) {
    let current = await this.identity(page);
    if (current.id === target.identityId && current.kind === target.kind) return;
    current = await this.switchName(page, target.name, current.id);
    if (current.id !== target.identityId || current.kind !== target.kind)
      throw new NeedsUser("切换后的身份 ID 与目标不一致，未提交；请手动切换后继续");
  }
  private dialog(page: Page) {
    const withEditor = page.getByRole("dialog").filter({
      has: page.locator('[role="textbox"][contenteditable="true"]'),
    });
    // Ignore wrappers containing another editor dialog, but retain composers
    // containing auxiliary dialogs without a textbox.
    return withEditor.filter({ hasNot: withEditor }).filter({ visible: true });
  }
  private async links(page: Page) {
    return new Set(
      (
        await page
          .locator("a[href]")
          .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href))
      )
        .map(postUrl)
        .filter((url): url is string => Boolean(url)),
    );
  }
  async prepare(task: Task, target: TaskTarget) {
    this.prepared = undefined;
    const page = await this.getPage();
    await this.ready(page);
    await this.selectTarget(page, target);
    if (task.contentKind === "video" && !task.images.some(isVideo))
      throw new NeedsUser("Facebook 视频需要一段视频");
    if (task.contentKind === "moment" && task.images.some(isVideo))
      throw new NeedsUser("动态不能包含视频");
    if (task.contentKind === "article" && task.images.some(isVideo))
      throw new NeedsUser("文章不能包含视频");
    if (task.contentKind !== "video" && !task.body.trim()) throw new Error("正文不能为空");
    // Validate all files before touching the composer.
    for (const path of task.images) await readFile(path);
    if ((await this.dialog(page).count()) === 0) {
      await this.navigate(page, `https://www.facebook.com/profile.php?id=${target.identityId}`);
      const identity = await this.identity(page);
      if (identity.id !== target.identityId)
        throw new NeedsUser("目标主页加载后身份不一致，未提交");
      this.authorPath = new URL(page.url()).pathname;
    }
    const beforeCompose = await this.links(page);
    const existing = this.dialog(page);
    if (await existing.count()) {
      // A manually edited composer must never be silently overwritten on resume.
      const text = normal(
        await existing.locator('[role="textbox"][contenteditable="true"]').innerText(),
      );
      if (text && text !== normal(task.body))
        throw new NeedsUser("Facebook 编辑器已有其他内容，请保存或清空后继续");
      if (task.images.length)
        throw new NeedsUser("编辑器已有图文草稿，请关闭草稿后继续，以免重复上传图片");
    } else {
      const opener = page
        .getByRole("button", { name: labels.composer })
        .or(page.getByRole("button", { name: labels.create }));
      await (await this.unique(opener, "未找到发帖入口，请打开当前身份主页后继续")).click();
    }
    const dialog = await this.unique(this.dialog(page), "未识别到 Facebook 发帖编辑器");
    await this.unique(
      dialog.locator('[role="textbox"][contenteditable="true"]'),
      "正文编辑器不唯一",
    );
    if (task.images.length) {
      let files = dialog.locator('input[type="file"][accept*="image"]');
      if ((await files.count()) !== 1) {
        await (
          await this.unique(
            dialog.getByRole("button", { name: labels.photo }),
            "未找到照片上传入口",
          )
        ).click();
        files = dialog.locator('input[type="file"][accept*="image"]');
      }
      if ((await files.count()) !== 1) throw new NeedsUser("未识别到唯一的图片上传控件");
      await files.setInputFiles(task.images);
      // File selection is not upload completion: require rendered attachment previews and idle UI.
      await page.waitForFunction(
        ({ count }) => {
          const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(
            (d) =>
              d.querySelector('[role="textbox"][contenteditable="true"]') &&
              ![...d.querySelectorAll('[role="dialog"]')].some((child) =>
                child.querySelector('[role="textbox"][contenteditable="true"]'),
              ),
          );
          if (dialogs.length !== 1) return false;
          const d = dialogs[0];
          const busy = d.querySelector('[role="progressbar"], [aria-busy="true"]');
          const images = [...d.querySelectorAll("img")].filter(
            (i) =>
              /^(blob:|data:)|fbcdn\.net/.test(i.src) && i.naturalWidth > 0 && i.clientWidth > 80,
          );
          const videos = [...d.querySelectorAll("video")].filter((video) =>
            Boolean(video.currentSrc || video.src || video.querySelector("source")),
          );
          const processing = [...d.querySelectorAll("span, div")].some(
            (el) =>
              !el.children.length &&
              /正在上传|上传中|正在处理|Uploading|Processing/.test(el.textContent ?? ""),
          );
          // Facebook folds a gallery into five previews. The final tile's +N
          // includes that tile, so five visible images and +7 represent 11.
          let attachments = images.length + videos.length;
          for (const label of d.querySelectorAll("div, span")) {
            if (label.children.length) continue;
            const more = /^\+(\d+)$/.exec(label.textContent?.trim() ?? "");
            if (!more) continue;
            let tile = label.parentElement;
            while (tile && tile !== d && !tile.querySelector("img")) tile = tile.parentElement;
            const previews = tile ? [...tile.querySelectorAll("img")] : [];
            if (previews.length === 1 && images.includes(previews[0]))
              attachments = Math.max(attachments, images.length - 1 + Number(more[1]));
          }
          return !busy && !processing && attachments >= count;
        },
        { count: task.images.length },
        { timeout: task.images.some(isVideo) ? 180000 : 90000 },
      );
      if (await dialog.getByText(labels.uploading).filter({ visible: true }).count())
        throw new NeedsUser("图片仍在上传，请等待完成后继续");
    }
    // Uploading attachments can remount or clear Facebook's Lexical editor.
    // Fill only after attachment previews settle, using a fresh live locator.
    const finalEditor = await this.unique(
      this.dialog(page).locator('[role="textbox"][contenteditable="true"]'),
      "上传后正文编辑器不唯一",
    );
    // Lexical can discard bulk insertText input, including the first character
    // of an immediate fallback. Use sequential keyboard input from the outset.
    const lexical = await finalEditor.getAttribute("data-lexical-editor");
    if (lexical !== "true") await finalEditor.fill(task.body);
    if (lexical === "true" || normal(await finalEditor.innerText()) !== normal(task.body)) {
      if (normal(await finalEditor.innerText())) {
        await finalEditor.press("ControlOrMeta+A");
        await finalEditor.press("Backspace");
        await page.waitForFunction(
          (element) => !element?.textContent?.trim(),
          await finalEditor.elementHandle(),
        );
      }
      await finalEditor.pressSequentially(task.body);
    }
    if (normal(await finalEditor.innerText()) !== normal(task.body))
      throw new Error("Facebook 编辑器正文与任务不一致");
    // Photo posts need one settings step. Reels adds an editor step, so keep
    // advancing the largest visible Next until a single Post button is ready.
    let submit: Locator | undefined;
    for (let step = 0; step < 4; step++) {
      const post = page
        .getByRole("dialog")
        .getByRole("button", { name: labels.post })
        .filter({ visible: true });
      const next = page
        .getByRole("dialog")
        .getByRole("button", { name: labels.next })
        .filter({ visible: true });
      await post
        .or(next)
        .first()
        .waitFor({ timeout: 20000 })
        .catch(() => {});
      if ((await post.count()) === 1) {
        submit = post;
        break;
      }
      const count = await next.count();
      if (!count) throw new NeedsUser("未找到发布按钮或下一步");
      let pick = next.first();
      let width = -1;
      for (let index = 0; index < count; index++) {
        const box = await next.nth(index).boundingBox();
        if (box && box.width > width) {
          width = box.width;
          pick = next.nth(index);
        }
      }
      await pick.click();
    }
    if (!submit) throw new NeedsUser("未找到唯一的发布按钮");
    if (!(await submit.isEnabled()))
      throw new NeedsUser("发布按钮未就绪，请检查图片上传、受众或必填设置");
    const identity = await this.identity(page);
    if (identity.id !== target.identityId || identity.kind !== target.kind)
      throw new NeedsUser("发布前身份已变化，未提交");
    const before = new Set([...beforeCompose, ...(await this.links(page))]);
    this.prepared = { taskId: task.id, targetId: target.id, before };
    this.journal?.save(target.id, { before: [...before], authorPath: this.authorPath });
  }
  async submit(task: Task, target: TaskTarget, markSubmitted: () => void) {
    if (this.prepared?.taskId !== task.id || this.prepared.targetId !== target.id)
      throw new NotSubmitted("任务未完成发布准备");
    const page = await this.getPage();
    const identity = await this.identity(page);
    if (identity.id !== target.identityId || identity.kind !== target.kind)
      throw new NotSubmitted("提交前身份变化，已停止");
    const button = await this.unique(
      page.getByRole("dialog").getByRole("button", { name: labels.post }),
      "发布按钮不唯一，未再次点击",
    );
    const withPost = page.getByRole("dialog").filter({
      has: page.getByRole("button", { name: labels.post }),
    });
    const dialog = withPost.filter({ hasNot: withPost }).filter({ visible: true });
    const editor = dialog.locator('[role="textbox"][contenteditable="true"]');
    const editorText = (await editor.count()) === 1 ? await editor.innerText() : null;
    if (editorText === null || normal(editorText) !== normal(task.body)) {
      const more = dialog
        .getByRole("button", { name: /^(See more|展开|查看更多|查看全文)$/i })
        .filter({ visible: true });
      if ((await more.count()) === 1) await more.click({ timeout: 3000 }).catch(() => {});
      if (!composerStillHasPost(editorText, await dialog.innerText(), task.body))
        throw new NotSubmitted("提交前编辑内容已变化，未点击发布");
    }
    if (await dialog.locator('[role="progressbar"], [aria-busy="true"]').count())
      throw new NotSubmitted("上传状态变化，未点击发布");
    markSubmitted();
    await button.click({ timeout: 15000 });
  }
  async verify(task: Task, target: TaskTarget): Promise<string | null> {
    const page = await this.getPage();
    for (let i = 0; i < 30; i++) {
      if ((await this.dialog(page).count()) === 0) {
        const articles = page.getByRole("article").filter({ hasText: task.body.trim() });
        for (const article of await articles.all()) {
          if (await this.matchesArticle(article, task, target)) {
            const urls = (
              await article
                .locator("a[href]")
                .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href))
            ).map(postUrl);
            const candidate = urls.find((url): url is string =>
              Boolean(url && !this.prepared?.before.has(url)),
            );
            if (candidate) {
              this.journal?.save(target.id, {
                before: [...(this.prepared?.before ?? [])],
                candidate,
                authorPath: this.authorPath,
              });
              await this.navigate(page, candidate);
              await page
                .getByRole("article")
                .first()
                .waitFor({ timeout: 15000 })
                .catch(() => {});
              for (const post of await page.getByRole("article").all()) {
                if (await this.matchesArticle(post, task, target)) return candidate;
              }
              return null;
            }
          }
        }
      }
      await page.waitForTimeout(500);
    }
    return null;
  }
  private async matchesArticle(article: Locator, task: Task, target: Target) {
    const more = article
      .getByRole("button", { name: /^(See more|展开|查看更多)$/i })
      .filter({ visible: true });
    if ((await more.count()) === 1) await more.click({ timeout: 3000 }).catch(() => {});
    const evidence = await article.evaluate((node) => {
      const images = [...node.querySelectorAll("img")].filter(
        (i) => i.naturalWidth > 0 && i.clientWidth > 80,
      );
      let imageCount = images.length;
      for (const label of node.querySelectorAll("div, span")) {
        if (label.children.length) continue;
        const more = /^\+(\d+)$/.exec(label.textContent?.trim() ?? "");
        if (!more) continue;
        let tile = label.parentElement;
        while (tile && tile !== node && !tile.querySelector("img")) tile = tile.parentElement;
        const previews = tile ? [...tile.querySelectorAll("img")] : [];
        if (previews.length === 1 && images.includes(previews[0]))
          imageCount = Math.max(imageCount, images.length - 1 + Number(more[1]));
      }
      const videos = [...node.querySelectorAll("video")].filter((video) => video.clientWidth > 80);
      return {
        text: (node as HTMLElement).innerText,
        links: [...node.querySelectorAll("h2 a[href], h3 a[href], h4 a[href], strong a[href]")].map(
          (a) => (a as HTMLAnchorElement).href,
        ),
        imageCount: imageCount + videos.length,
      };
    });
    if (
      !normal(evidence.text).includes(normal(task.body)) ||
      evidence.imageCount < task.images.length
    )
      return false;
    return evidence.links.some((href) => {
      const u = new URL(href);
      return (
        ["facebook.com", "www.facebook.com"].includes(u.hostname) &&
        (u.searchParams.get("id") === target.identityId ||
          u.pathname === `/${target.identityId}` ||
          u.pathname.startsWith(`/${target.identityId}/`) ||
          (this.authorPath !== "/" &&
            this.authorPath !== "/profile.php" &&
            u.pathname === this.authorPath))
      );
    });
  }
  async verifyExisting(
    task: Task,
    target: TaskTarget,
    suppliedUrl?: string,
  ): Promise<string | null> {
    const saved = this.journal?.load(target.id);
    const url = postUrl(suppliedUrl || target.url || saved?.candidate || "");
    if (!url)
      throw new NeedsUser(
        "尚无可核验的帖子链接，请在 Facebook 找到实际帖子并提供链接；不会自动重发",
      );
    const page = await this.getPage();
    await this.selectTarget(page, target);
    this.authorPath = saved?.authorPath ?? null;
    await this.navigate(page, url);
    await page
      .getByRole("article")
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    for (const article of await page.getByRole("article").all()) {
      if (await this.matchesArticle(article, task, target)) return url;
    }
    return null;
  }
}
