import { extname } from "node:path";

export function isVideo(path: string) {
  return [".mp4", ".mov", ".m4v", ".webm"].includes(extname(path).toLowerCase());
}

export function postTitle(body: string, limit: number, fallback: string) {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  const title = line || fallback;
  return title.length <= limit ? title : title.slice(0, limit);
}
