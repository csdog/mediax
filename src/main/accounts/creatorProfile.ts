import type { PlatformId } from "../../shared/models";

export type CreatorPlatform = "toutiao" | "xiaohongshu" | "channels";

export function isCreatorPlatform(platform: PlatformId): platform is CreatorPlatform {
  return platform === "toutiao" || platform === "xiaohongshu" || platform === "channels";
}

// Serialized into the account page: keep all DOM helpers inside this function.
export function readCreatorProfile(platform: CreatorPlatform) {
  const hosts = {
    toutiao: "mp.toutiao.com",
    xiaohongshu: "creator.xiaohongshu.com",
    channels: "channels.weixin.qq.com",
  };
  if (location.hostname !== hosts[platform] || /login|signin|qrconnect/i.test(location.pathname))
    return null;
  const selectors = {
    toutiao: {
      root: '.information a[href*="toutiao.com/c/user/"]',
      name: ".auth-avator-name",
      image: ".auth-avator-img",
    },
    xiaohongshu: { root: ".user-info", name: ".name-box", image: "img.user_avatar" },
    channels: {
      root: ".finder-info-container",
      name: ".finder-nickname",
      image: 'img[alt="视频号头像"]',
    },
  }[platform];
  const root = document.querySelector(selectors.root);
  if (!root) return null;
  const name = (
    root.querySelector(selectors.name)?.textContent ??
    (platform === "toutiao" ? root.textContent : "")
  )?.trim();
  if (!name || name.length > 80) return null;
  const image = root.querySelector<HTMLImageElement>(selectors.image);
  let href: string | null = null;
  if (image) {
    try {
      const url = new URL(image.currentSrc || image.src, location.href);
      if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
    } catch {
      /* Keep the name when the avatar is not ready. */
    }
  }
  return { name, href };
}
