import { readFileSync, writeFileSync } from "node:fs";

export type BrowserHistoryEntry = {
  url: string;
  title: string;
  visitedAt: number;
  icon?: string;
  accountId?: string;
  accountLabel?: string;
  accountAvatar?: string;
};

const limit = 200;
const suggestions = 8;

export function rememberVisit(
  entries: BrowserHistoryEntry[],
  url: string,
  title: string,
  now: number,
  touch: boolean,
  icon?: string,
  accountId?: string,
  accountLabel?: string,
  accountAvatar?: string,
): BrowserHistoryEntry[] {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    return entries;
  }
  if (page.protocol !== "http:" && page.protocol !== "https:") return entries;
  const href = page.href;
  const name = title.trim() || page.hostname;
  const existing = entries.find((entry) => entry.url === href);
  const nextIcon = icon || existing?.icon;
  if (!touch && existing?.title === name && existing.icon === nextIcon) return entries;
  const nextAccountId = accountId ?? existing?.accountId;
  const nextAccountLabel = accountLabel ?? existing?.accountLabel;
  const nextAccountAvatar = accountAvatar ?? existing?.accountAvatar;
  const next = [
    {
      url: href,
      title: name,
      visitedAt: touch || !existing ? now : existing.visitedAt,
      ...(nextIcon ? { icon: nextIcon } : {}),
      ...(nextAccountId ? { accountId: nextAccountId } : {}),
      ...(nextAccountLabel ? { accountLabel: nextAccountLabel } : {}),
      ...(nextAccountAvatar ? { accountAvatar: nextAccountAvatar } : {}),
    },
    ...entries.filter((entry) => entry.url !== href),
  ];
  next.sort((a, b) => b.visitedAt - a.visitedAt);
  return next.slice(0, limit);
}

export function matchBrowserHistory(entries: BrowserHistoryEntry[], query: string) {
  const needle = query.trim().toLowerCase();
  const ranked = [...entries].sort((a, b) => b.visitedAt - a.visitedAt);
  const matched = needle
    ? ranked.filter(
        (entry) =>
          entry.url.toLowerCase().includes(needle) ||
          entry.title.toLowerCase().includes(needle) ||
          entry.accountLabel?.toLowerCase().includes(needle),
      )
    : ranked;
  return matched.slice(0, suggestions);
}

export function removeHistoryEntry(entries: BrowserHistoryEntry[], url: string) {
  try {
    const href = new URL(url).href;
    const next = entries.filter((entry) => entry.url !== href);
    return next.length === entries.length ? entries : next;
  } catch {
    return entries;
  }
}

function readEntries(path: string): BrowserHistoryEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Partial<BrowserHistoryEntry>;
      if (typeof entry.url !== "string" || typeof entry.visitedAt !== "number") return [];
      const icon =
        typeof entry.icon === "string" && entry.icon.startsWith("data:image/")
          ? entry.icon
          : undefined;
      const accountId = typeof entry.accountId === "string" ? entry.accountId : undefined;
      const accountLabel =
        typeof entry.accountLabel === "string" ? entry.accountLabel.trim() : undefined;
      const accountAvatar =
        typeof entry.accountAvatar === "string" && entry.accountAvatar.startsWith("data:image/")
          ? entry.accountAvatar
          : undefined;
      return [
        {
          url: entry.url,
          title: entry.title?.trim() || entry.url,
          visitedAt: entry.visitedAt,
          ...(icon ? { icon } : {}),
          ...(accountId ? { accountId } : {}),
          ...(accountLabel ? { accountLabel } : {}),
          ...(accountAvatar ? { accountAvatar } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export class BrowserHistoryStore {
  private entries: BrowserHistoryEntry[];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private path: string) {
    this.entries = readEntries(path);
  }

  remember(
    url: string,
    title: string,
    touch = true,
    icon?: string,
    accountId?: string,
    accountLabel?: string,
    accountAvatar?: string,
  ) {
    const next = rememberVisit(
      this.entries,
      url,
      title,
      Date.now(),
      touch,
      icon,
      accountId,
      accountLabel,
      accountAvatar,
    );
    if (next === this.entries) return;
    this.entries = next;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.save();
    }, 300);
  }

  search(query: string) {
    return matchBrowserHistory(this.entries, query);
  }

  remove(url: string) {
    const next = removeHistoryEntry(this.entries, url);
    if (next === this.entries) return;
    this.entries = next;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.save();
  }

  private save() {
    try {
      writeFileSync(this.path, JSON.stringify(this.entries));
    } catch {
      /* History is a convenience list; a failed write should not break navigation. */
    }
  }
}
