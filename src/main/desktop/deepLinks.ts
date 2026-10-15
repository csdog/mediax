import { app } from "electron";
import { resolve } from "node:path";
import type { DesktopCommand, DesktopPage } from "../../shared/models";

const pages = new Set<DesktopPage>(["accounts", "publish", "history", "calendar", "analytics"]);

/** Prefer registering once early so cold-start open-url / argv deep links work. */
export function registerDeepLinkProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2)
      app.setAsDefaultProtocolClient("mediax", process.execPath, [resolve(process.argv[1])]);
    return;
  }
  app.setAsDefaultProtocolClient("mediax");
}

export function findDeepLinkArg(argv: readonly string[]) {
  return argv.find((arg) => /^mediax:\/\//i.test(arg));
}

/**
 * Accepted forms:
 * - mediax://publish
 * - mediax://history/<taskId>
 * - mediax://history?taskId=<id>
 * - mediax://settings
 */
export function parseDeepLink(raw: string): DesktopCommand | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "mediax:") return null;
  const parts = [url.hostname, ...url.pathname.split("/")]
    .map((part) => part.trim())
    .filter(Boolean);
  const head = parts[0]?.toLowerCase();
  if (!head || head === "open" || head === "publish")
    return { action: "navigate", page: "publish" };
  if (head === "settings") return { action: "settings" };
  if (!pages.has(head as DesktopPage)) return null;
  const page = head as DesktopPage;
  const taskId =
    page === "history"
      ? parts[1] || url.searchParams.get("taskId") || url.searchParams.get("task") || undefined
      : undefined;
  return { action: "navigate", page, taskId: taskId || undefined };
}
