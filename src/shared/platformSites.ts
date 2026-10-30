import type { PlatformId } from "./models";

// Public/creator entry points; authenticated pages redirect to login when needed.
export const platformSites: Record<PlatformId, { home: string; hosts: readonly string[] }> = {
  facebook: { home: "https://www.facebook.com/", hosts: ["facebook.com"] },
  youtube: { home: "https://studio.youtube.com/", hosts: ["youtube.com"] },
  tiktok: { home: "https://www.tiktok.com/tiktokstudio", hosts: ["tiktok.com"] },
  instagram: { home: "https://www.instagram.com/", hosts: ["instagram.com"] },
  threads: { home: "https://www.threads.com/", hosts: ["threads.com", "threads.net"] },
  twitter: { home: "https://x.com/home", hosts: ["x.com", "twitter.com"] },
  linkedin: { home: "https://www.linkedin.com/feed/", hosts: ["linkedin.com"] },
  pinterest: { home: "https://www.pinterest.com/", hosts: ["pinterest.com"] },
  reddit: { home: "https://old.reddit.com/", hosts: ["reddit.com"] },
  douyin: { home: "https://creator.douyin.com/creator-micro/home", hosts: ["douyin.com"] },
  kuaishou: { home: "https://cp.kuaishou.com/", hosts: ["kuaishou.com"] },
  xiaohongshu: { home: "https://creator.xiaohongshu.com/", hosts: ["xiaohongshu.com"] },
  bilibili: { home: "https://member.bilibili.com/platform/home", hosts: ["bilibili.com"] },
  channels: { home: "https://channels.weixin.qq.com/platform", hosts: ["channels.weixin.qq.com"] },
  wechat: { home: "https://mp.weixin.qq.com/", hosts: ["mp.weixin.qq.com"] },
  weibo: { home: "https://me.weibo.com/", hosts: ["weibo.com"] },
  baijiahao: {
    home: "https://baijiahao.baidu.com/builder/rc/home",
    hosts: ["baijiahao.baidu.com"],
  },
  toutiao: { home: "https://mp.toutiao.com/profile_v4/index", hosts: ["toutiao.com"] },
  zhihu: { home: "https://www.zhihu.com/creator", hosts: ["zhihu.com"] },
  qq: { home: "https://om.qq.com/", hosts: ["om.qq.com"] },
  alipay: {
    home: "https://c.alipay.com/page/life-account/index?_appScene=CONTENT&appId=2030022469359777",
    hosts: ["c.alipay.com"],
  },
  hupu: { home: "https://www.hupu.com/", hosts: ["hupu.com"] },
  sohu: { home: "https://mp.sohu.com/", hosts: ["mp.sohu.com"] },
  yidian: { home: "https://mp.yidianzixun.com/", hosts: ["mp.yidianzixun.com"] },
  dayu: { home: "https://mp.dayu.com/", hosts: ["mp.dayu.com", "mp.uc.cn"] },
  netease: { home: "https://mp.163.com/", hosts: ["mp.163.com"] },
  iqiyi: { home: "https://creator.iqiyi.com/", hosts: ["creator.iqiyi.com", "mp.iqiyi.com"] },
  weishi: { home: "https://media.weishi.qq.com/", hosts: ["weishi.qq.com"] },
  sohuvideo: { home: "https://tv.sohu.com/s/my/user/media/index.html", hosts: ["tv.sohu.com"] },
  pipixia: { home: "https://www.pipix.com/mp/upload", hosts: ["pipix.com"] },
  tencentvideo: { home: "https://v.qq.com/", hosts: ["v.qq.com"] },
  duoduo: {
    home: "https://live.yangkeduo.com/",
    hosts: ["live.yangkeduo.com", "live.pinduoduo.com"],
  },
  meipai: { home: "https://www.meipai.com/", hosts: ["meipai.com"] },
  acfun: { home: "https://member.acfun.cn/", hosts: ["acfun.cn"] },
  kuaichuan: { home: "https://kuaichuan.360kuai.com/", hosts: ["kuaichuan.360kuai.com"] },
  xueqiu: { home: "https://mp.xueqiu.com/", hosts: ["mp.xueqiu.com"] },
  fengwang: { home: "https://o.fun.tv/", hosts: ["o.fun.tv"] },
  dewu: { home: "https://creator.dewu.com/", hosts: ["dewu.com"] },
  jd: { home: "https://ce.jd.com/", hosts: ["ce.jd.com"] },
  douban: { home: "https://www.douban.com/", hosts: ["douban.com"] },
  csdn: { home: "https://mp.csdn.net/", hosts: ["mp.csdn.net"] },
  jianshu: { home: "https://www.jianshu.com/writer", hosts: ["jianshu.com"] },
  chejia: { home: "https://creator.autohome.com.cn/", hosts: ["creator.autohome.com.cn"] },
  xhsmerchant: { home: "https://ark.xiaohongshu.com/", hosts: ["ark.xiaohongshu.com"] },
  yiche: { home: "https://mp.yiche.com/", hosts: ["mp.yiche.com"] },
  dongche: { home: "https://mp.dongchedi.com/", hosts: ["mp.dongchedi.com"] },
  ximalaya: { home: "https://studio.ximalaya.com/", hosts: ["studio.ximalaya.com"] },
  xiaoyuzhou: {
    home: "https://podcaster.xiaoyuzhoufm.com/",
    hosts: ["podcaster.xiaoyuzhoufm.com"],
  },
  guanghe: { home: "https://creator.guanghe.taobao.com/", hosts: ["creator.guanghe.taobao.com"] },
  xhsdm: { home: "https://pro.xiaohongshu.com/", hosts: ["pro.xiaohongshu.com"] },
  zsxq: { home: "https://wx.zsxq.com/", hosts: ["wx.zsxq.com"] },
  music163: { home: "https://music.163.com/st/musician", hosts: ["music.163.com"] },
  qqmusic: { home: "https://y.qq.com/artists/", hosts: ["y.qq.com"] },
  qingting: { home: "https://admin.qingting.fm/", hosts: ["qingting.fm", "qtfm.cn"] },
  lizhi: { home: "https://nj.lizhi.fm/", hosts: ["lizhi.fm"] },
  googlebusiness: { home: "https://business.google.com/locations", hosts: ["business.google.com"] },
};

export function isPlatformUrl(platform: PlatformId, value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      platformSites[platform].hosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

/** Match the most specific host, so Tencent video/music and XHS variants stay distinct. */
export function platformForUrl(value: string): PlatformId | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    let matched: PlatformId | null = null;
    let specificity = 0;
    for (const [platform, site] of Object.entries(platformSites)) {
      for (const host of site.hosts) {
        if (
          (url.hostname === host || url.hostname.endsWith(`.${host}`)) &&
          host.length > specificity
        ) {
          matched = platform as PlatformId;
          specificity = host.length;
        }
      }
    }
    return matched;
  } catch {
    return null;
  }
}

export function isPlatformLoginUrl(platform: PlatformId, value: string) {
  if (!isPlatformUrl(platform, value)) return true;
  const url = new URL(value);
  if (/^(?:passport|accounts|auth|login|sso)\./i.test(url.hostname)) return true;
  if (platform === "channels" && !/^\/platform(?:\/|$)/.test(url.pathname)) return true;
  const route = url.pathname + (url.hash.startsWith("#/") ? url.hash.slice(1).split("?")[0] : "");
  return /(?:^|\/)(?:login|newlogin|signin|sign-in|passport|userauth|bizlogin|oauth|qrconnect)(?:[/.]|$)/i.test(
    route,
  );
}
