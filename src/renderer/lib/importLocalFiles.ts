import type { ContentKind, ImageAsset } from "../../shared/models";

export async function applyLocalFiles(
  paths: string[],
  kind: ContentKind,
  current: ImageAsset[],
): Promise<{
  markdown: string | null;
  images: ImageAsset[];
  notice: string;
}> {
  const result = await window.desktop.importLocalFiles(paths, kind);
  const images =
    kind === "article" && result.assets.length
      ? result.assets.slice(0, 1)
      : [
          ...current,
          ...result.assets.filter((item) => !current.some((image) => image.path === item.path)),
        ];
  const parts: string[] = [];
  if (result.markdown != null) parts.push("已导入 Markdown");
  if (result.assets.length) parts.push(`已添加 ${result.assets.length} 个素材`);
  if (result.warnings.length) parts.push(result.warnings[0]);
  return {
    markdown: result.markdown,
    images,
    notice: parts.join(" · ") || "没有可导入的文件",
  };
}

export function pathsFromDataTransfer(transfer: DataTransfer | null) {
  if (!transfer?.files?.length || !window.desktop.pathForFile) return [];
  return [...transfer.files]
    .map((file) => {
      try {
        return window.desktop.pathForFile!(file);
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}
