import { FileText, Images, Music2, Video } from "lucide-react";
import type { ContentKind } from "../../shared/models";

export const publishKindMeta: Record<
  ContentKind,
  {
    title: string;
    action: string;
    hint: string;
    mediaAction: string;
    icon: typeof Video;
    gradient: string;
  }
> = {
  video: {
    title: "视频发布",
    action: "发布视频",
    hint: "添加本地视频，填写标题与简介后选择账号一键发布",
    mediaAction: "添加本地视频",
    icon: Video,
    gradient: "linear-gradient(145deg, #a78bfa 0%, #7c3aed 100%)",
  },
  moment: {
    title: "图文发布",
    action: "发布图文",
    hint: "添加图片，填写标题与描述后选择账号一键发布",
    mediaAction: "添加图片",
    icon: Images,
    gradient: "linear-gradient(145deg, #7dd3fc 0%, #2563eb 100%)",
  },
  article: {
    title: "文章发布",
    action: "发布文章",
    hint: "填写标题与正文，可添加封面后选择账号一键发布",
    mediaAction: "添加封面",
    icon: FileText,
    gradient: "linear-gradient(145deg, #fda4af 0%, #e11d48 100%)",
  },
  audio: {
    title: "音频发布",
    action: "发布音频",
    hint: "添加本地音频，填写标题与简介后选择账号一键发布",
    mediaAction: "添加本地音频",
    icon: Music2,
    gradient: "linear-gradient(145deg, #c4b5fd 0%, #4f46e5 100%)",
  },
};
