import type { PlatformId } from "../../shared/models";
import { isChannelsPlatformUrl } from "./channels/session";

type Session = {
  home: string;
  cookieUrl: string;
  cookies: readonly string[];
  challenge?: RegExp;
};

function known(
  home: string,
  cookieUrl: string,
  cookies: readonly string[],
  challenge?: RegExp,
): Session {
  return { home, cookieUrl, cookies, challenge };
}

function login(home: string): Session {
  return { home, cookieUrl: home, cookies: [] };
}

const sessions: Record<PlatformId, Session> = {
  facebook: known(
    "https://www.facebook.com/",
    "https://www.facebook.com",
    ["c_user"],
    /checkpoint|two_step_verification/,
  ),
  youtube: known(
    "https://studio.youtube.com/",
    "https://www.youtube.com",
    ["SID", "LOGIN_INFO", "__Secure-1PSID", "__Secure-3PSID"],
    /accounts\.google\.com\/.*challenge/,
  ),
  tiktok: known(
    "https://www.tiktok.com/login",
    "https://www.tiktok.com",
    ["sessionid", "sid_tt", "sessionid_ss"],
    /tiktok\.com\/.*captcha/i,
  ),
  instagram: known("https://www.instagram.com/accounts/login/", "https://www.instagram.com", [
    "sessionid",
  ]),
  threads: known("https://www.threads.com/login", "https://www.threads.com", ["sessionid"]),
  twitter: known("https://x.com/i/flow/login", "https://x.com", ["auth_token"]),
  linkedin: known("https://www.linkedin.com/login", "https://www.linkedin.com", ["li_at"]),
  pinterest: known("https://www.pinterest.com/login/", "https://www.pinterest.com", [
    "_pinterest_sess",
  ]),
  reddit: known("https://www.reddit.com/login", "https://www.reddit.com", ["reddit_session"]),
  douyin: known("https://creator.douyin.com/", "https://creator.douyin.com", ["sessionid"]),
  kuaishou: known("https://cp.kuaishou.com/", "https://cp.kuaishou.com", [
    "userId",
    "kuaishou.web.cp.api_st",
    "passToken",
  ]),
  xiaohongshu: known("https://creator.xiaohongshu.com/login", "https://creator.xiaohongshu.com", [
    "customer-sso-sid",
    "access-token-creator.xiaohongshu.com",
  ]),
  bilibili: known("https://passport.bilibili.com/login", "https://www.bilibili.com", ["SESSDATA"]),
  // wxuin identifies a WeChat user even on the logged-out QR login page.
  channels: known("https://channels.weixin.qq.com/platform", "https://channels.weixin.qq.com", [
    "sessionid",
  ]),
  wechat: known("https://mp.weixin.qq.com/", "https://mp.weixin.qq.com", [
    "slave_sid",
    "slave_user",
    "data_ticket",
  ]),
  weibo: known("https://passport.weibo.com/sso/signin?entry=miniblog", "https://weibo.com", [
    "SUB",
  ]),
  baijiahao: known(
    "https://baijiahao.baidu.com/builder/theme/bjh/login",
    "https://baijiahao.baidu.com",
    ["BDUSS"],
  ),
  toutiao: known("https://mp.toutiao.com/auth/page/login", "https://mp.toutiao.com", [
    "sessionid",
    "sso_uid_tt",
  ]),
  zhihu: known("https://www.zhihu.com/signin", "https://www.zhihu.com", ["z_c0"]),
  qq: known("https://om.qq.com/userAuth/index", "https://om.qq.com", ["userid", "omtoken"]),
  alipay: known("https://c.alipay.com/page/portal/home", "https://c.alipay.com", [
    "ALIPAYJSESSIONID",
    "ctoken",
  ]),
  hupu: known(
    "https://passport.hupu.com/v2/login?pcPhone=1&jumpurl=https://www.hupu.com",
    "https://www.hupu.com",
    ["u"],
  ),
  sohu: login("https://mp.sohu.com/"),
  yidian: login("https://mp.yidianzixun.com/"),
  dayu: login("https://mp.uc.cn/"),
  netease: login("https://mp.163.com/"),
  iqiyi: login("https://mp.iqiyi.com/"),
  weishi: login("https://weishi.qq.com/"),
  sohuvideo: login("https://tv.sohu.com/"),
  pipixia: login("https://www.pipix.com/"),
  tencentvideo: login("https://v.qq.com/"),
  duoduo: login("https://live.pinduoduo.com/"),
  meipai: login("https://www.meipai.com/"),
  acfun: login("https://www.acfun.cn/"),
  kuaichuan: login("https://kuaichuan.360kuai.com/"),
  xueqiu: login("https://mp.xueqiu.com/"),
  fengwang: login("https://www.fengwang.com/"),
  dewu: login("https://www.dewu.com/"),
  jd: login("https://ce.jd.com/"),
  douban: login("https://www.douban.com/"),
  csdn: login("https://mp.csdn.net/"),
  jianshu: login("https://www.jianshu.com/"),
  chejia: login("https://creator.autohome.com.cn/"),
  xhsmerchant: login("https://ark.xiaohongshu.com/"),
  yiche: login("https://mp.yiche.com/"),
  dongche: login("https://mp.dongchedi.com/"),
  ximalaya: login("https://studio.ximalaya.com/"),
  xiaoyuzhou: login("https://podcaster.xiaoyuzhoufm.com/"),
  guanghe: login("https://creator.guanghe.taobao.com/"),
  xhsdm: login("https://pro.xiaohongshu.com/"),
  zsxq: login("https://wx.zsxq.com/"),
  music163: login("https://music.163.com/st/musician"),
  qqmusic: login("https://y.qq.com/artists/"),
  qingting: login("https://www.qingting.fm/"),
  lizhi: login("https://www.lizhi.fm/"),
  googlebusiness: login("https://business.google.com/"),
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

export function hasPlatformSession(platform: PlatformId, cookies: { name: string }[], url = "") {
  if (platform === "channels" && url && !isChannelsPlatformUrl(url)) return false;
  const names = sessions[platform].cookies;
  return cookies.some((cookie) => names.includes(cookie.name));
}

export function keepsClosedSession(platform: PlatformId) {
  return sessions[platform].cookies.length === 0;
}

export function urlLooksLoggedIn(platform: PlatformId, url: string) {
  if (!keepsClosedSession(platform) || !url) return false;
  try {
    const current = new URL(url);
    const home = new URL(sessions[platform].cookieUrl);
    const host =
      current.hostname === home.hostname || current.hostname.endsWith(`.${home.hostname}`);
    if (!host) return false;
    return !/login|signin|passport|userAuth/i.test(`${current.pathname}${current.search}`);
  } catch {
    return false;
  }
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
