import { expect, it } from "vitest";
import { platforms } from "../../../src/shared/models";
import {
  platformSites,
  platformForUrl,
  isPlatformUrl,
  isPlatformLoginUrl,
} from "../../../src/shared/platformSites";
import { hasPlatformSession, platformHome } from "../../../src/main/platforms/catalog";

it.each(platforms)("audits %s home, icon routing, and foreign/login URL boundaries", (platform) => {
  const site = platformSites[platform];
  expect(platformHome[platform]).toBe(site.home);
  expect(isPlatformUrl(platform, site.home)).toBe(true);
  expect(platformForUrl(site.home)).toBe(platform);
  expect(isPlatformLoginUrl(platform, site.home)).toBe(false);
  const url = new URL(site.home);
  url.pathname = "/login";
  expect(isPlatformLoginUrl(platform, url.href)).toBe(true);
  url.pathname = "/";
  url.hash = "#/login?redirect=/home";
  expect(isPlatformLoginUrl(platform, url.href)).toBe(true);
  expect(isPlatformUrl(platform, `https://${url.hostname}.example.org/`)).toBe(false);
  expect(isPlatformUrl(platform, `https://example.org/?next=${site.home}`)).toBe(false);
  expect(isPlatformUrl(platform, `file://${url.hostname}/`)).toBe(false);
});

it.each([
  ["https://member.bilibili.com/platform/home", "bilibili"],
  ["https://zhuanlan.zhihu.com/write", "zhihu"],
  ["https://old.reddit.com/", "reddit"],
  ["https://me.weibo.com/", "weibo"],
  ["https://studio.youtube.com/", "youtube"],
  ["https://creator.xiaohongshu.com/", "xiaohongshu"],
  ["https://ark.xiaohongshu.com/", "xhsmerchant"],
  ["https://pro.xiaohongshu.com/", "xhsdm"],
  ["https://v.qq.com/", "tencentvideo"],
  ["https://y.qq.com/artists/", "qqmusic"],
  ["https://om.qq.com/", "qq"],
  ["https://mp.weixin.qq.com/", "wechat"],
  ["https://channels.weixin.qq.com/platform", "channels"],
  ["https://www.threads.net/", "threads"],
  ["https://twitter.com/home", "twitter"],
  ["https://accounts.google.com/", null],
  ["https://creator.iqiyi.com/", "iqiyi"],
  ["https://mp.dayu.com/", "dayu"],
  ["https://mp.uc.cn/", "dayu"],
  ["https://live.yangkeduo.com/", "duoduo"],
  ["https://o.fun.tv/", "fengwang"],
  ["https://www.fengwang.com/", null],
  ["https://member.acfun.cn/", "acfun"],
  ["https://creator.dewu.com/", "dewu"],
  ["https://admin.qingting.fm/", "qingting"],
  ["https://www.qtfm.cn/", "qingting"],
  ["https://nj.lizhi.fm/", "lizhi"],
  ["https://example.org/?redirect=https://www.bilibili.com", null],
])("resolves the actual site for %s", (url, platform) => {
  expect(platformForUrl(url)).toBe(platform);
});

it.each([
  ["bilibili", "SESSDATA"],
  ["zhihu", "z_c0"],
  ["weibo", "SUB"],
  ["douyin", "sessionid"],
  ["kuaishou", "userId"],
  ["tiktok", "sessionid"],
] as const)("does not trust stale %s cookies on its login page", (platform, cookie) => {
  const url = new URL(platformHome[platform]);
  url.pathname = "/login";
  expect(hasPlatformSession(platform, [{ name: cookie }], url.href)).toBe(false);
});
