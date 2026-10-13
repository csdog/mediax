import { basename, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { markdownToText } from "./markdown";
import { isAudio, isImage, isVideo } from "../../shared/content";
import type { ContentKind, ImageAsset } from "../../shared/models";

const markdownExtensions = new Set([".md", ".markdown"]);

export function isMarkdownPath(path: string) {
  return markdownExtensions.has(extname(path).toLowerCase());
}

export function acceptsMediaFile(kind: ContentKind | undefined, path: string) {
  if (kind === "video") return isVideo(path);
  if (kind === "audio") return isAudio(path);
  if (kind === "article" || kind === "moment") return isImage(path);
  return isImage(path) || isVideo(path);
}

function imageMime(path: string) {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

export async function loadMediaAsset(path: string): Promise<ImageAsset> {
  const data = await readFile(path);
  if (data.length > 20 * 1024 * 1024) throw new Error("素材限制为 20MB，请压缩后选择");
  const media = isVideo(path) || isAudio(path);
  return {
    path,
    name: basename(path),
    preview: media ? "" : `data:${imageMime(path)};base64,${data.toString("base64")}`,
  };
}

export type LocalImportResult = {
  markdown: string | null;
  assets: ImageAsset[];
  warnings: string[];
};

export async function importLocalPaths(
  paths: string[],
  kind: ContentKind,
  cache: Map<string, ImageAsset>,
): Promise<LocalImportResult> {
  const warnings: string[] = [];
  const assets: ImageAsset[] = [];
  let markdown: string | null = null;
  for (const path of paths) {
    if (isMarkdownPath(path)) {
      if (markdown != null) {
        warnings.push(`已忽略额外的 Markdown：${basename(path)}`);
        continue;
      }
      markdown = markdownToText(await readFile(path, "utf8"));
      continue;
    }
    if (!acceptsMediaFile(kind, path)) {
      warnings.push(`与当前内容类型不符：${basename(path)}`);
      continue;
    }
    if (kind === "article" && assets.length >= 1) {
      warnings.push("文章只能带一张封面，已忽略其余图片");
      continue;
    }
    try {
      const asset = await loadMediaAsset(path);
      cache.set(path, asset);
      if (!assets.some((item) => item.path === path)) assets.push(asset);
    } catch (error) {
      warnings.push(`${basename(path)}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { markdown, assets, warnings };
}
