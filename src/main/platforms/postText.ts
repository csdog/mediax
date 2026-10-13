export { isVideo } from "../../shared/content";

export function postTitle(body: string, limit: number, fallback: string) {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  const title = line || fallback;
  return title.length <= limit ? title : title.slice(0, limit);
}
