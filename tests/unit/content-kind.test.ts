import { expect, it } from "vitest";
import { platforms, type PlatformId } from "../../src/shared/models";
import { supportedKinds, validatePublish } from "../../src/shared/content";

const table: Record<string, readonly string[]> = {
  toutiao: ["article", "moment", "video"],
  zhihu: ["article", "moment", "video"],
  douyin: ["article", "moment", "video"],
  xiaohongshu: ["article", "moment", "video"],
  weibo: ["article", "moment", "video"],
  baijiahao: ["article", "moment", "video"],
  facebook: ["article", "moment", "video"],
  wechat: ["article", "moment"],
  douban: ["article", "moment"],
  zsxq: ["article", "moment"],
  bilibili: ["article", "video"],
  qq: ["article", "video"],
  jianshu: ["article"],
  reddit: ["article"],
  kuaishou: ["moment", "video"],
  channels: ["moment", "video"],
  instagram: ["moment", "video"],
  twitter: ["moment", "video"],
  threads: ["moment"],
  pinterest: ["moment"],
  linkedin: ["moment"],
  googlebusiness: ["moment"],
  ximalaya: ["audio"],
  xiaoyuzhou: ["audio"],
  music163: ["audio"],
  qqmusic: ["audio"],
  qingting: ["audio"],
  lizhi: ["audio"],
  youtube: ["video"],
  tiktok: ["video"],
  hupu: ["video"],
  alipay: ["video"],
};

it("lists the confirmed content types and leaves other platforms unpublished", () => {
  for (const [platform, kinds] of Object.entries(table))
    expect(supportedKinds(platform as PlatformId)).toEqual(kinds);
  for (const platform of platforms) {
    if (platform in table) continue;
    expect(supportedKinds(platform)).toEqual([]);
  }
});

it("checks title, attachments, and platform support before a task is created", () => {
  expect(() =>
    validatePublish({
      kind: "article",
      title: "  ",
      body: "正文",
      paths: [],
      platforms: ["jianshu"],
    }),
  ).toThrow("请填写文章标题");
  expect(() =>
    validatePublish({
      kind: "moment",
      title: null,
      body: "动态",
      paths: ["/tmp/clip.mp4"],
      platforms: ["douyin"],
    }),
  ).toThrow("动态不能包含视频");
  expect(() =>
    validatePublish({
      kind: "audio",
      title: null,
      body: "",
      paths: [],
      platforms: ["ximalaya"],
    }),
  ).toThrow("请选择一个音频文件");
  expect(() =>
    validatePublish({
      kind: "article",
      title: "标题",
      body: "正文",
      paths: [],
      platforms: ["hupu"],
    }),
  ).toThrow("虎扑不支持文章");
  expect(() =>
    validatePublish({
      kind: "article",
      title: "标题",
      body: "正文",
      paths: ["/tmp/cover.png"],
      platforms: ["jianshu"],
    }),
  ).not.toThrow();
});
