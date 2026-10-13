import { expect, it } from "vitest";
import {
  hasPlatformSession,
  sessionOwner,
  urlLooksLoggedIn,
} from "../../src/main/platforms/catalog";
import { isVideo, postTitle } from "../../src/main/platforms/postText";
import { createPublisher } from "../../src/main/platforms/registry";
import { Database } from "../../src/main/storage/Database";

it("names a post from the first line and detects video files", () => {
  expect(postTitle("第一行标题\n后面是正文", 100, "未命名")).toBe("第一行标题");
  expect(postTitle("  ", 10, "未命名视频")).toBe("未命名视频");
  expect(postTitle("一二三四五", 3, "未命名")).toBe("一二三");
  expect(isVideo("/tmp/clip.MP4")).toBe(true);
  expect(isVideo("/tmp/photo.png")).toBe(false);
});

it("treats YouTube and Reddit session cookies as logged in", () => {
  expect(hasPlatformSession("youtube", [{ name: "SID" }])).toBe(true);
  expect(hasPlatformSession("youtube", [{ name: "VISITOR_INFO1_LIVE" }])).toBe(false);
  expect(sessionOwner("youtube", [{ name: "SID", value: "rotating" }])).toBe("youtube");
  expect(hasPlatformSession("tiktok", [{ name: "sessionid" }])).toBe(true);
  expect(hasPlatformSession("tiktok", [{ name: "tt_csrf_token" }])).toBe(false);
  expect(sessionOwner("tiktok", [{ name: "sid_tt", value: "rotating" }])).toBe("tiktok");
  expect(hasPlatformSession("reddit", [{ name: "reddit_session" }])).toBe(true);
  expect(sessionOwner("reddit", [])).toBeNull();
  expect(sessionOwner("facebook", [{ name: "c_user", value: "100" }])).toBe("100");
  expect(urlLooksLoggedIn("sohu", "https://mp.sohu.com/home")).toBe(true);
  expect(urlLooksLoggedIn("sohu", "https://mp.sohu.com/login")).toBe(false);
  expect(urlLooksLoggedIn("facebook", "https://www.facebook.com/")).toBe(false);
});

it("gives implemented platforms their own publisher", () => {
  const open = async () => {
    throw new Error("unused");
  };
  expect(createPublisher("douyin", open).constructor.name).toBe("DouyinAdapter");
  expect(createPublisher("kuaishou", open).constructor.name).toBe("KuaishouAdapter");
  expect(createPublisher("xiaohongshu", open).constructor.name).toBe("XiaohongshuAdapter");
  expect(createPublisher("channels", open).constructor.name).toBe("ChannelsAdapter");
  expect(createPublisher("bilibili", open).constructor.name).toBe("BilibiliAdapter");
  expect(createPublisher("baijiahao", open).constructor.name).toBe("BaijiahaoAdapter");
  expect(createPublisher("weibo", open).constructor.name).toBe("WeiboAdapter");
  expect(createPublisher("hupu", open).constructor.name).toBe("HupuAdapter");
  expect(createPublisher("alipay", open).constructor.name).toBe("AlipayAdapter");
  expect(createPublisher("youtube", open).constructor.name).toBe("YouTubeAdapter");
  expect(createPublisher("sohu", open).constructor.name).toBe("LoginAdapter");
  expect(createPublisher("instagram", open).constructor.name).toBe("LoginAdapter");
});

it("stores the selected platform on a new account", () => {
  const db = new Database(":memory:");
  const youtube = db.addAccount("频道", "youtube");
  const tiktok = db.addAccount("短视频", "tiktok");
  const reddit = db.addAccount("社区", "reddit");
  expect(db.accounts().map((account) => account.platform)).toEqual(["youtube", "tiktok", "reddit"]);
  expect(youtube.platform).toBe("youtube");
  expect(tiktok.platform).toBe("tiktok");
  expect(reddit.platform).toBe("reddit");
  db.close();
});
