import type { Page } from "playwright-core";
import type { ContentKind } from "../../../shared/models";
import { WebPublisher, type WebFlow } from "./WebPublisher";

const login = /login|signin|passport|userAuth|bizlogin/i;

function flow(
  platform: WebFlow["platform"],
  label: string,
  home: string,
  urls: Partial<Record<ContentKind, string>>,
  loggedOut: (url: string) => boolean = (url) => login.test(url),
): WebFlow {
  return { platform, label, home, urls, loggedOut };
}

const wechat = flow(
  "wechat",
  "微信公众号",
  "https://mp.weixin.qq.com/",
  {
    article:
      "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77",
    moment:
      "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10",
  },
  (url) => /login|bizlogin/i.test(url),
);
const toutiao = flow("toutiao", "头条号", "https://mp.toutiao.com/", {
  article: "https://mp.toutiao.com/profile_v4/graphic/publish",
  moment: "https://mp.toutiao.com/profile_v4/weitoutiao/publish",
  video: "https://mp.toutiao.com/profile_v4/xigua/upload-video",
});
const zhihu = flow("zhihu", "知乎", "https://www.zhihu.com/", {
  article: "https://zhuanlan.zhihu.com/write",
  moment: "https://www.zhihu.com/",
  video: "https://www.zhihu.com/zvideo/upload-video",
});
const qq = flow("qq", "企鹅号", "https://om.qq.com/", {
  article: "https://om.qq.com/article/articlePublish",
  video: "https://om.qq.com/video/videoPublish",
});
const douban = flow("douban", "豆瓣", "https://www.douban.com/", {
  article: "https://www.douban.com/note/create",
  moment: "https://www.douban.com/",
});
const jianshu = flow("jianshu", "简书", "https://www.jianshu.com/writer", {
  article: "https://www.jianshu.com/writer",
});
const zsxq = flow("zsxq", "知识星球", "https://wx.zsxq.com/", {
  article: "https://wx.zsxq.com/",
  moment: "https://wx.zsxq.com/",
});
const ximalaya = flow("ximalaya", "喜马拉雅", "https://studio.ximalaya.com/", {
  audio: "https://studio.ximalaya.com/upload",
});
const xiaoyuzhou = flow("xiaoyuzhou", "小宇宙", "https://podcaster.xiaoyuzhoufm.com/", {
  audio: "https://podcaster.xiaoyuzhoufm.com/",
});
const music163 = flow("music163", "网易云音乐", "https://music.163.com/st/musician", {
  audio: "https://music.163.com/st/musician",
});
const qqmusic = flow("qqmusic", "QQ音乐", "https://y.qq.com/artists/", {
  audio: "https://y.qq.com/artists/",
});
const qingting = flow("qingting", "蜻蜓FM", "https://www.qingting.fm/", {
  audio: "https://www.qingting.fm/",
});
const lizhi = flow("lizhi", "荔枝FM", "https://www.lizhi.fm/", {
  audio: "https://www.lizhi.fm/",
});
const instagram = flow(
  "instagram",
  "Instagram",
  "https://www.instagram.com/",
  {
    moment: "https://www.instagram.com/",
    video: "https://www.instagram.com/",
  },
  (url) => /\/accounts\/login|signin/i.test(url),
);
const threads = flow("threads", "Threads", "https://www.threads.com/", {
  moment: "https://www.threads.com/",
});
const twitter = flow("twitter", "X", "https://x.com/compose/post", {
  moment: "https://x.com/compose/post",
  video: "https://x.com/compose/post",
});
const pinterest = flow("pinterest", "Pinterest", "https://www.pinterest.com/pin-creation-tool/", {
  moment: "https://www.pinterest.com/pin-creation-tool/",
});
const linkedin = flow("linkedin", "LinkedIn", "https://www.linkedin.com/feed/", {
  moment: "https://www.linkedin.com/feed/",
});
const googlebusiness = flow("googlebusiness", "Google Business", "https://business.google.com/", {
  moment: "https://business.google.com/",
});

function publisher(flowConfig: WebFlow) {
  return class extends WebPublisher {
    constructor(page: () => Promise<Page>) {
      super(page, flowConfig);
    }
  };
}

export class WechatAdapter extends publisher(wechat) {}
export class ToutiaoAdapter extends publisher(toutiao) {}
export class ZhihuAdapter extends publisher(zhihu) {}
export class QqAdapter extends publisher(qq) {}
export class DoubanAdapter extends publisher(douban) {}
export class JianshuAdapter extends publisher(jianshu) {}
export class ZsxqAdapter extends publisher(zsxq) {}
export class XimalayaAdapter extends publisher(ximalaya) {}
export class XiaoyuzhouAdapter extends publisher(xiaoyuzhou) {}
export class Music163Adapter extends publisher(music163) {}
export class QqmusicAdapter extends publisher(qqmusic) {}
export class QingtingAdapter extends publisher(qingting) {}
export class LizhiAdapter extends publisher(lizhi) {}
export class InstagramAdapter extends publisher(instagram) {}
export class ThreadsAdapter extends publisher(threads) {}
export class TwitterAdapter extends publisher(twitter) {}
export class PinterestAdapter extends publisher(pinterest) {}
export class LinkedinAdapter extends publisher(linkedin) {}
export class GoogleBusinessAdapter extends publisher(googlebusiness) {}
