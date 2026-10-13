import { app } from "electron";
import { resolve } from "node:path";
import type { DesktopCommand, DesktopPage } from "../../shared/models";

const pages = new Set<DesktopPage>(["accounts", "compose", "video", "history"]);

/** Prefer registering once early so cold-start open-url / argv deep links work. */
export function registerDeepLinkProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2)
      app.setAsDefaultProtocolClient("media-post", process.execPath, [resolve(process.argv[1])]);
    return;
  }
  app.setAsDefaultProtocolClient("media-post");
}

export function findDeepLinkArg(argv: readonly string[]) {
  return argv.find((arg) => /^media-post:\/\//i.test(arg));
}

/**
 * Accepted forms:
 * - media-post://compose
 * - media-post://history/<taskId>
 * - media-post://history?taskId=<id>
 * - media-post://settings
 */
export function parseDeepLink(raw: string): DesktopCommand | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "media-post:") return null;
  const parts = [url.hostname, ...url.pathname.split("/")]
    .map((part) => part.trim())
    .filter(Boolean);
  const head = parts[0]?.toLowerCase();
  if (!head || head === "open") return { action: "navigate", page: "compose" };
  if (head === "settings") return { action: "settings" };
  if (!pages.has(head as DesktopPage)) return null;
  const page = head as DesktopPage;
  const taskId =
    page === "history"
      ? parts[1] || url.searchParams.get("taskId") || url.searchParams.get("task") || undefined
      : undefined;
  return { action: "navigate", page, taskId: taskId || undefined };
}
