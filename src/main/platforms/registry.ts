import type { Page } from "playwright-core";
import type { PlatformId, Target } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";
import { AlipayAdapter } from "./alipay/AlipayAdapter";
import { BaijiahaoAdapter } from "./baijiahao/BaijiahaoAdapter";
import { BilibiliAdapter } from "./bilibili/BilibiliAdapter";
import { ChannelsAdapter } from "./channels/ChannelsAdapter";
import { DouyinAdapter } from "./douyin/DouyinAdapter";
import { HupuAdapter } from "./hupu/HupuAdapter";
import { KuaishouAdapter } from "./kuaishou/KuaishouAdapter";
import { LoginAdapter } from "./login/LoginAdapter";
import type { Publisher } from "./Publisher";
import { RedditAdapter } from "./reddit/RedditAdapter";
import { TikTokAdapter } from "./tiktok/TikTokAdapter";
import { WeiboAdapter } from "./weibo/WeiboAdapter";
import { XiaohongshuAdapter } from "./xiaohongshu/XiaohongshuAdapter";
import { YouTubeAdapter } from "./youtube/YouTubeAdapter";

export type PlatformPublisher = Publisher & {
  discover(accountId: string): Promise<Target[]>;
};

export function createPublisher(
  platform: Exclude<PlatformId, "facebook">,
  openPage: () => Promise<Page>,
): PlatformPublisher {
  switch (platform) {
    case "youtube":
      return new YouTubeAdapter(openPage);
    case "tiktok":
      return new TikTokAdapter(openPage);
    case "reddit":
      return new RedditAdapter(openPage);
    case "douyin":
      return new DouyinAdapter(openPage);
    case "kuaishou":
      return new KuaishouAdapter(openPage);
    case "xiaohongshu":
      return new XiaohongshuAdapter(openPage);
    case "channels":
      return new ChannelsAdapter(openPage);
    case "bilibili":
      return new BilibiliAdapter(openPage);
    case "baijiahao":
      return new BaijiahaoAdapter(openPage);
    case "weibo":
      return new WeiboAdapter(openPage);
    case "hupu":
      return new HupuAdapter(openPage);
    case "alipay":
      return new AlipayAdapter(openPage);
    default:
      return new LoginAdapter(openPage, platformInfo[platform].label);
  }
}
