import type { PlatformId } from "../../shared/models";

export type AccountProfile = {
  name: string | null;
  href: string | null;
  rect?: { x: number; y: number; width: number; height: number } | null;
};

// Serialized into the account page. Only read account controls, never content authors.
export function readAccountHeader(input: {
  platform: PlatformId;
  hosts: readonly string[];
}): AccountProfile | null {
  if (
    !input.hosts.some(
      (host) => location.hostname === host || location.hostname.endsWith(`.${host}`),
    ) ||
    /(?:^|\/)(?:login|newlogin|signin|sign-in|passport|userauth|bizlogin|oauth|qrconnect)(?:[/.]|$)/i.test(
      location.pathname,
    )
  )
    return null;

  const clean = (value: string | null | undefined) => {
    const name = value?.trim();
    if (
      !name ||
      name.length > 80 ||
      /^(?:avatar|profile|your profile|account|me|头像|账号|账户|帐户|我|个人主页|登录|退出登录)$/i.test(
        name,
      )
    )
      return null;
    const wrapped = name.match(/^(?:点击)?(?:打开|进入)(.+?)的(?:个人)?主页$/);
    return wrapped?.[1]?.trim() || name;
  };
  const pack = (root: Element, name: string | null) => {
    const image = root.matches("img,svg image") ? root : root.querySelector("img,svg image");
    let href: string | null = null;
    let rect: AccountProfile["rect"] = null;
    if (image) {
      const raw = image.getAttribute("src") || image.getAttribute("href");
      if (raw) {
        try {
          const url = new URL(raw, location.href);
          if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
        } catch {
          /* Keep the name when the avatar is unavailable. */
        }
      }
      const r = image.getBoundingClientRect();
      if (
        r.width >= 16 &&
        r.height >= 16 &&
        r.width <= 160 &&
        r.height <= 160 &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight
      )
        rect = {
          x: Math.floor(r.x),
          y: Math.floor(r.y),
          width: Math.ceil(r.width),
          height: Math.ceil(r.height),
        };
    }
    return name || href || rect ? { name, href, ...(rect ? { rect } : {}) } : null;
  };

  if (input.platform === "reddit") {
    const user = document.querySelector("#header-bottom-right .user a");
    const name = clean(user?.textContent)?.replace(/^u\//, "");
    if (name && !/log\s*in|sign\s*up|登录/i.test(name)) return { name: `u/${name}`, href: null };
    return null;
  }
  if (input.platform === "youtube") {
    const name = clean(document.querySelector("#entity-name, ytcp-entity-name")?.textContent);
    const image = document.querySelector("#entity-thumbnail, ytcp-navigation-drawer #avatar");
    return name ? (image ? pack(image, name) : { name, href: null }) : null;
  }
  if (input.platform === "zhihu") {
    const root = document.querySelector(".AppHeader-profile");
    if (root) return pack(root, clean(root.querySelector("img")?.getAttribute("alt")));
    const self = document.querySelector(
      'header img[alt^="点击打开"][alt$="的主页"], header img[alt^="点击进入"][alt$="的个人主页"]',
    );
    if (self) return pack(self, clean(self.getAttribute("alt")));
    return null;
  }
  if (input.platform === "twitter") {
    const root = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    return root ? pack(root, clean(root.querySelector("span")?.textContent)) : null;
  }
  if (input.platform === "kuaishou") {
    const root = document.querySelector(".header-info-card");
    if (root)
      return pack(root, clean(root.querySelector('.user-name, [class*="user-name"]')?.textContent));
  }
  if (input.platform === "douyin" && location.hostname === "creator.douyin.com") {
    const field = document.querySelector(
      "header .header-name, .header .header-name, .user-info .user-info-name",
    );
    const name = clean(field?.textContent);
    const root = field?.closest(".user-info, header, .header");
    if (root && name) return pack(root, name);
  }
  // These labels identify the current session's account control, including Facebook's
  // active Page. They must never be replaced by the first avatar elsewhere in the page.
  const menu = [...document.querySelectorAll('[role="button"],button')].find((node) =>
    /^(Account|Your profile|你的个人主页|账户|帐户|账号)$/i.test(
      node.getAttribute("aria-label") || "",
    ),
  );
  if (menu) return pack(menu, clean(menu.querySelector("img")?.getAttribute("alt")));

  // Creator consoles commonly expose their own identity in the navigation header.
  // Keep names and avatars within the same account container.
  const roots = document.querySelectorAll(
    "header .user-info, header .account-info, .header .user-info, .header .account-info, " +
      '.weui-desktop-account__info, .global-nav__me, [data-test-id="header-profile"]',
  );
  for (const root of roots) {
    const name = clean(
      root.querySelector(
        ".user-name, .username, .nickname, .name, .account-name, .weui-desktop-account__nickname",
      )?.textContent,
    );
    if (name) return pack(root, name);
  }
  return null;
}
