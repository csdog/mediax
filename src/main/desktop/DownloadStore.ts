import { app, type DownloadItem, type Session } from "electron";
import { basename, extname, join } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { BrowserDownload, BrowserDownloadState } from "../../shared/models";

function uniqueSavePath(filename: string) {
  const downloads = app.getPath("downloads");
  const base = basename(filename) || "download";
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let candidate = join(downloads, base);
  let index = 1;
  while (existsSync(candidate)) {
    candidate = join(downloads, `${stem} (${index})${ext}`);
    index += 1;
  }
  return candidate;
}

function mapState(state: string): BrowserDownloadState {
  if (state === "completed") return "completed";
  if (state === "cancelled") return "cancelled";
  if (state === "interrupted") return "interrupted";
  return "progressing";
}

export class DownloadStore {
  private items = new Map<string, BrowserDownload>();
  private active = new Map<string, DownloadItem>();
  private watched = new WeakSet<Session>();
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private onChange: () => void) {}

  list(): BrowserDownload[] {
    return [...this.items.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 50);
  }

  get(id: string) {
    return this.items.get(id) ?? null;
  }

  canReveal(id: string) {
    const item = this.items.get(id);
    return Boolean(item && item.state === "completed" && existsSync(item.path));
  }

  remove(id: string) {
    const download = this.items.get(id);
    if (!download) throw new Error("下载项不存在");
    const active = this.active.get(id);
    if (active && active.getState() === "progressing") active.cancel();
    this.active.delete(id);
    this.items.delete(id);
    this.notify(true);
  }

  watch(session: Session) {
    if (this.watched.has(session)) return;
    this.watched.add(session);
    session.on("will-download", (_event, item) => this.track(item));
  }

  private notify(immediate = false) {
    if (immediate) {
      if (this.notifyTimer) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = null;
      }
      this.onChange();
      return;
    }
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.onChange();
    }, 100);
  }

  private track(item: DownloadItem) {
    const id = randomUUID();
    const savePath = uniqueSavePath(item.getFilename());
    item.setSavePath(savePath);
    const record: BrowserDownload = {
      id,
      filename: basename(savePath),
      url: item.getURL(),
      path: savePath,
      state: "progressing",
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startedAt: Date.now(),
    };
    this.items.set(id, record);
    this.active.set(id, item);
    this.notify(true);

    const sync = () => {
      const current = this.items.get(id);
      if (!current) return;
      current.filename = basename(item.getSavePath() || current.path);
      current.path = item.getSavePath() || current.path;
      current.url = item.getURL();
      current.receivedBytes = item.getReceivedBytes();
      current.totalBytes = item.getTotalBytes();
      current.state = mapState(item.getState());
      if (current.state !== "progressing") {
        current.endedAt = Date.now();
        this.active.delete(id);
        this.notify(true);
        return;
      }
      this.notify();
    };

    item.on("updated", sync);
    item.once("done", (_event, state) => {
      const current = this.items.get(id);
      if (!current) return;
      current.state = mapState(state);
      current.receivedBytes = item.getReceivedBytes();
      current.totalBytes = item.getTotalBytes();
      current.path = item.getSavePath() || current.path;
      current.filename = basename(current.path);
      current.endedAt = Date.now();
      this.active.delete(id);
      this.notify(true);
    });
  }
}
