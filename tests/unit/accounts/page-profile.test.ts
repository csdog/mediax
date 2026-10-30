// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { platforms, type PlatformId } from "../../../src/shared/models";
import { platformSites } from "../../../src/shared/platformSites";
import { readAccountHeader } from "../../../src/main/accounts/pageProfile";
import { accountProfileScript } from "../../../src/main/accounts/platformProfile";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
function at(platform: PlatformId, path = "/") {
  const url = new URL(platformSites[platform].home);
  vi.stubGlobal("location", {
    hostname: url.hostname,
    pathname: path,
    href: `${url.origin}${path}`,
  });
}
function read(platform: PlatformId) {
  return readAccountHeader({ platform, hosts: platformSites[platform].hosts });
}

it.each(platforms)("never takes a content author's avatar as the %s account", async (platform) => {
  at(platform);
  document.body.innerHTML =
    '<article><img class="avatar" alt="推荐作者" src="https://images.example/other.png"><div class="user-info"><span class="name">别人</span><img src="https://images.example/other.png"></div></article>';
  expect(read(platform)).toBeNull();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  expect(await new Function(`return ${accountProfileScript(platform)}`)()).toBeNull();
});

it.each(platforms)("rejects another website's signed-in header for %s", (platform) => {
  vi.stubGlobal("location", {
    hostname: "example.org",
    pathname: "/",
    href: "https://example.org/",
  });
  document.body.innerHTML =
    '<header><div class="user-info"><span class="name">别站账号</span><img src="https://images.example/other.png"></div></header>';
  expect(read(platform)).toBeNull();
});

it.each([
  "sohu",
  "baijiahao",
  "qq",
  "netease",
  "wechat",
  "jianshu",
  "douban",
  "ximalaya",
  "zsxq",
  "instagram",
  "threads",
  "pinterest",
  "linkedin",
] as const)("pairs name/avatar within the %s account header", (platform) => {
  at(platform);
  document.body.innerHTML =
    '<img class="avatar" alt="推荐人物" src="https://images.example/other.png"><header><div class="user-info"><span class="nickname">真实账号 名称</span><img src="//images.example/self.png"></div></header>';
  expect(read(platform)).toEqual({
    name: "真实账号 名称",
    href: "https://images.example/self.png",
  });
  at(platform, "/login");
  expect(read(platform)).toBeNull();
});

it("reads only the Facebook account control and the wrapped Zhihu self label", () => {
  at("facebook");
  document.body.innerHTML =
    '<img class="avatar" alt="文章作者" src="https://images.example/other.png"><button aria-label="Your profile"><img alt="avatar" src="https://images.example/self.png"></button>';
  expect(read("facebook")).toEqual({ name: null, href: "https://images.example/self.png" });
  at("zhihu");
  document.body.innerHTML =
    '<img class="avatar" alt="文章作者" src="https://images.example/other.png"><div class="AppHeader-profile"><img alt="点击打开asir的主页" src="https://images.example/self.png"></div>';
  expect(read("zhihu")).toEqual({ name: "asir", href: "https://images.example/self.png" });
});

it("uses the signed-in Reddit header instead of post authors, and YouTube channel instead of videos", () => {
  at("reddit");
  document.body.innerHTML =
    '<a href="/u/other">其他作者</a><div id="header-bottom-right"><span class="user"><a href="/user/self">self</a></span></div>';
  expect(read("reddit")).toEqual({ name: "u/self", href: null });
  at("youtube");
  document.body.innerHTML =
    '<div id="entity-name">实际频道</div><div id="entity-thumbnail"><img src="https://images.example/channel.png"></div>';
  expect(read("youtube")).toEqual({ name: "实际频道", href: "https://images.example/channel.png" });
});
