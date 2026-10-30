import type { PlatformId } from "../../shared/models";
import { platformSites, isPlatformLoginUrl, isPlatformUrl } from "../../shared/platformSites";
export { platformForUrl } from "../../shared/platformSites";
import { isChannelsPlatformUrl } from "./channels/session";

type Session = {
  home: string;
  cookieUrl: string;
  cookies: readonly string[];
  challenge?: RegExp;
};

function known(
  platform: PlatformId,
  cookieUrl: string,
  cookies: readonly string[],
  challenge?: RegExp,
): Session {
  return { home: platformSites[platform].home, cookieUrl, cookies, challenge };
}

function login(platform: PlatformId): Session {
  const home = platformSites[platform].home;
  return { home, cookieUrl: home, cookies: [] };
}

const sessions: Record<PlatformId, Session> = {
  facebook: known(
    "facebook",
    "https://www.facebook.com",
    ["c_user"],
    /checkpoint|two_step_verification/,
  ),
  youtube: known(
    "youtube",
    "https://www.youtube.com",
    ["SID", "LOGIN_INFO", "__Secure-1PSID", "__Secure-3PSID"],
    /accounts\.google\.com\/.*challenge/,
  ),
  tiktok: known(
    "tiktok",
    "https://www.tiktok.com",
    ["sessionid", "sid_tt", "sessionid_ss"],
    /tiktok\.com\/.*captcha/i,
  ),
  instagram: known("instagram", "https://www.instagram.com", ["sessionid"]),
  threads: known("threads", "https://www.threads.com", ["sessionid"]),
  twitter: known("twitter", "https://x.com", ["auth_token"]),
  linkedin: known("linkedin", "https://www.linkedin.com", ["li_at"]),
  pinterest: known("pinterest", "https://www.pinterest.com", ["_pinterest_sess"]),
  reddit: known("reddit", "https://www.reddit.com", ["reddit_session"]),
  douyin: known("douyin", "https://creator.douyin.com", ["sessionid"]),
  kuaishou: known("kuaishou", "https://cp.kuaishou.com", [
    "userId",
    "kuaishou.web.cp.api_st",
    "passToken",
  ]),
  xiaohongshu: known("xiaohongshu", "https://creator.xiaohongshu.com", [
    "customer-sso-sid",
    "access-token-creator.xiaohongshu.com",
  ]),
  bilibili: known("bilibili", "https://www.bilibili.com", ["SESSDATA"]),
  // wxuin identifies a WeChat user even on the logged-out QR login page.
  channels: known("channels", "https://channels.weixin.qq.com", ["sessionid"]),
  wechat: known("wechat", "https://mp.weixin.qq.com", ["slave_sid", "slave_user", "data_ticket"]),
  weibo: known("weibo", "https://weibo.com", ["SUB"]),
  baijiahao: known("baijiahao", "https://baijiahao.baidu.com", ["BDUSS"]),
  toutiao: known("toutiao", "https://mp.toutiao.com", ["sessionid", "sso_uid_tt"]),
  zhihu: known("zhihu", "https://www.zhihu.com", ["z_c0"]),
  qq: known("qq", "https://om.qq.com", ["userid", "omtoken"]),
  alipay: known("alipay", "https://c.alipay.com", ["ALIPAYJSESSIONID", "ctoken"]),
  hupu: known("hupu", "https://www.hupu.com", ["u"]),
  sohu: login("sohu"),
  yidian: login("yidian"),
  dayu: login("dayu"),
  netease: login("netease"),
  iqiyi: login("iqiyi"),
  weishi: login("weishi"),
  sohuvideo: login("sohuvideo"),
  pipixia: login("pipixia"),
  tencentvideo: login("tencentvideo"),
  duoduo: login("duoduo"),
  meipai: login("meipai"),
  acfun: login("acfun"),
  kuaichuan: login("kuaichuan"),
  xueqiu: login("xueqiu"),
  fengwang: login("fengwang"),
  dewu: login("dewu"),
  jd: login("jd"),
  douban: login("douban"),
  csdn: login("csdn"),
  jianshu: login("jianshu"),
  chejia: login("chejia"),
  xhsmerchant: login("xhsmerchant"),
  yiche: login("yiche"),
  dongche: login("dongche"),
  ximalaya: login("ximalaya"),
  xiaoyuzhou: login("xiaoyuzhou"),
  guanghe: login("guanghe"),
  xhsdm: login("xhsdm"),
  zsxq: login("zsxq"),
  music163: login("music163"),
  qqmusic: login("qqmusic"),
  qingting: login("qingting"),
  lizhi: login("lizhi"),
  googlebusiness: login("googlebusiness"),
};

export const platformHome = Object.fromEntries(
  Object.entries(sessions).map(([id, session]) => [id, session.home]),
) as Record<PlatformId, string>;

export const platformCookieUrl = Object.fromEntries(
  Object.entries(sessions).map(([id, session]) => [id, session.cookieUrl]),
) as Record<PlatformId, string>;

export function partitionName(platform: PlatformId, id: string) {
  return `persist:${platform}-${id}`;
}

export function sessionCookieNames(platform: PlatformId) {
  return sessions[platform].cookies;
}

export function hasPlatformSession(platform: PlatformId, cookies: { name: string }[], url = "") {
  if (url && isPlatformUrl(platform, url) && isPlatformLoginUrl(platform, url)) return false;
  if (platform === "channels" && url && !isChannelsPlatformUrl(url)) return false;
  if (platform === "xiaohongshu" && url) {
    try {
      const current = new URL(url);
      if (
        current.hostname === "creator.xiaohongshu.com" &&
        /^\/(?:login|signin)(?:[/.]|$)/i.test(current.pathname)
      )
        return false;
    } catch {
      return false;
    }
  }
  const names = sessions[platform].cookies;
  return cookies.some((cookie) => names.includes(cookie.name));
}

export function keepsClosedSession(platform: PlatformId) {
  return sessions[platform].cookies.length === 0;
}

// A candidate workspace URL, not proof of login: callers also require a scoped profile.
export function urlLooksLoggedIn(platform: PlatformId, url: string) {
  return keepsClosedSession(platform) && Boolean(url) && !isPlatformLoginUrl(platform, url);
}

// Facebook keeps the stable c_user id. Other session cookies rotate,
// so a logged-in account uses a fixed owner and does not drop saved identities.
export function sessionOwner(
  platform: PlatformId,
  cookies: { name: string; value: string }[],
  url = "",
) {
  if (!hasPlatformSession(platform, cookies, url)) return null;
  if (platform === "facebook")
    return cookies.find((cookie) => cookie.name === "c_user")?.value ?? null;
  return platform;
}

export function needsVerification(platform: PlatformId, url: string) {
  return sessions[platform].challenge?.test(url) ?? false;
}
