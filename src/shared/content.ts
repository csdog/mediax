import type { ContentKind, PlatformId } from "./models";
import { platformInfo } from "./platforms";

const videoExtensions = [".mp4", ".mov", ".m4v", ".webm"];
const audioExtensions = [".mp3", ".m4a", ".wav", ".aac", ".flac"];
const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function extension(path: string) {
  const clean = path.split(/[?#]/)[0] ?? path;
  const slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  const name = clean.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function isVideo(path: string) {
  return videoExtensions.includes(extension(path));
}

export function isAudio(path: string) {
  return audioExtensions.includes(extension(path));
}

export function isImage(path: string) {
  return imageExtensions.includes(extension(path));
}

export function inferContentKind(paths: string[]): ContentKind {
  if (paths.some(isVideo)) return "video";
  if (paths.some(isAudio)) return "audio";
  if (paths.length) return "moment";
  return "article";
}

const capabilities: Partial<Record<PlatformId, readonly ContentKind[]>> = {
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

export function supportedKinds(platform: PlatformId): ContentKind[] {
  return [...(capabilities[platform] ?? [])];
}

const kindLabel: Record<ContentKind, string> = {
  article: "文章",
  moment: "动态",
  video: "视频",
  audio: "音频",
};

export type PublishRequest = {
  kind: ContentKind;
  title: string | null;
  body: string;
  paths: string[];
  platforms: PlatformId[];
};

export function validatePublish(request: PublishRequest) {
  const { kind, title, body, paths, platforms } = request;
  for (const platform of platforms) {
    if (!supportedKinds(platform).includes(kind))
      throw new Error(`${platformInfo[platform].label}不支持${kindLabel[kind]}`);
  }
  if (kind === "article") {
    if (!title?.trim()) throw new Error("请填写文章标题");
    if (!body.trim()) throw new Error("请填写正文");
    if (paths.length > 1) throw new Error("文章只能带一张封面");
    if (paths.some((path) => !isImage(path))) throw new Error("文章封面只能是图片");
    return;
  }
  if (kind === "moment") {
    if (!body.trim()) throw new Error("请填写正文");
    if (paths.some(isVideo)) throw new Error("动态不能包含视频");
    if (paths.some((path) => !isImage(path))) throw new Error("动态只能包含图片");
    return;
  }
  if (kind === "video") {
    if (paths.filter(isVideo).length !== 1) throw new Error("请选择一个视频文件");
    if (paths.some(isAudio)) throw new Error("视频不能包含音频");
    if (paths.some((path) => !isVideo(path) && !isImage(path)))
      throw new Error("视频封面只能是图片");
    return;
  }
  if (paths.filter(isAudio).length !== 1) throw new Error("请选择一个音频文件");
  if (paths.some(isVideo)) throw new Error("音频不能包含视频");
  if (paths.some((path) => !isAudio(path) && !isImage(path))) throw new Error("音频封面只能是图片");
}
