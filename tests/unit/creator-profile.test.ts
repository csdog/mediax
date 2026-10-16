// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCreatorProfile, type CreatorPlatform } from "../../src/main/accounts/creatorProfile";
import { discoverProfile } from "../../src/main/platforms/form";
import type { Page } from "playwright-core";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
function pageAt(hostname: string, pathname = "/") {
  vi.stubGlobal("location", { hostname, pathname, href: `https://${hostname}${pathname}` });
}

describe("creator account profile", () => {
  it.each([
    [
      "toutiao",
      "mp.toutiao.com",
      '<div class="information"><a href="//www.toutiao.com/c/user/123/"><img class="auth-avator-img" src="https://images.example/self.png"><div class="auth-avator-name">M潮人</div></a></div>',
      "M潮人",
    ],
    [
      "xiaohongshu",
      "creator.xiaohongshu.com",
      '<div class="user-info"><img class="user_avatar" src="https://images.example/self.png"><span class="name-box">cscs</span><div>退出登录</div></div>',
      "cscs",
    ],
    [
      "channels",
      "channels.weixin.qq.com",
      '<div class="finder-info-container"><img alt="视频号头像" src="https://images.example/self.png"><div><h2 class="finder-nickname">asir</h2></div></div>',
      "asir",
    ],
  ] as const)(
    "reads only the signed-in %s identity, even with unrelated avatars first",
    (platform, host, html, name) => {
      pageAt(host);
      document.body.innerHTML =
        '<img class="avatar" alt="别人的头像" src="https://images.example/other.png">' + html;
      // Also exercise the serialized function used by Electron executeJavaScript.
      const read = new Function(`return (${readCreatorProfile.toString()})`)();
      expect(read(platform)).toEqual({ name, href: "https://images.example/self.png" });
    },
  );

  it("does not guess identity from login-page promotions or another website", () => {
    pageAt("mp.toutiao.com", "/auth/page/login");
    document.body.innerHTML =
      '<img class="avatar" alt="宣传人物" src="https://images.example/other.png">';
    expect(readCreatorProfile("toutiao")).toBeNull();
    pageAt("www.toutiao.com");
    document.body.innerHTML =
      '<div class="information"><a href="https://www.toutiao.com/c/user/1/">别人</a></div>';
    expect(readCreatorProfile("toutiao")).toBeNull();
  });

  it("keeps the real name while an avatar has not loaded and avoids content authors", () => {
    pageAt("creator.xiaohongshu.com");
    document.body.innerHTML =
      '<div class="user-info"><span class="name-box">cscs</span></div><img alt="avatar" src="https://images.example/academy.png">';
    expect(readCreatorProfile("xiaohongshu")).toEqual({ name: "cscs", href: null });
    document.body.innerHTML = '<img alt="avatar" src="https://images.example/academy.png">';
    expect(readCreatorProfile("xiaohongshu")).toBeNull();
  });

  it("waits for the account header and uses its name for the publish identity", async () => {
    const page = {
      url: () => "https://channels.weixin.qq.com/platform",
      waitForFunction: vi.fn(async () => {}),
      evaluate: vi.fn(async () => ({ name: "asir", href: null })),
    } as unknown as Page;
    expect(
      await discoverProfile(page, "a", "视频号", () => false, "channels" satisfies CreatorPlatform),
    ).toEqual([{ accountId: "a", identityId: "1", name: "asir", kind: "profile" }]);
    expect(page.waitForFunction).toHaveBeenCalledWith(readCreatorProfile, "channels", {
      timeout: 10_000,
    });
  });
});
