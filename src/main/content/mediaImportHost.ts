import { app, utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";
import type { ContentKind, ImageAsset } from "../../shared/models";
import { log } from "../logging";
import { importLocalPaths, type LocalImportResult } from "./mediaAssets";

type WorkerResponse =
  | { ready: true }
  | { id: number; ok: true; result: LocalImportResult }
  | { id: number; ok: false; error: string };

/**
 * Runs media/Markdown import in a UtilityProcess so base64 decode and marked
 * parsing do not block Chromium's UI thread (VS Code / Codex style offload).
 */
export class MediaImportHost {
  private child: UtilityProcess | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: LocalImportResult) => void; reject: (error: Error) => void }
  >();

  async import(
    paths: string[],
    kind: ContentKind,
    cache: Map<string, ImageAsset>,
  ): Promise<LocalImportResult> {
    if (!paths.length) return { markdown: null, assets: [], warnings: [] };
    try {
      await this.ensureChild();
      const result = await this.request(paths, kind);
      for (const asset of result.assets) cache.set(asset.path, asset);
      return result;
    } catch (error) {
      log.warn("Media import utility process failed; falling back in-process", error);
      return importLocalPaths(paths, kind, cache);
    }
  }

  dispose() {
    for (const [, pending] of this.pending) pending.reject(new Error("应用正在退出"));
    this.pending.clear();
    this.child?.kill();
    this.child = null;
    this.ready = null;
  }

  private ensureChild() {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const script = join(__dirname, "mediaImportWorker.js");
      const child = utilityProcess.fork(script, [], {
        serviceName: "mediax-media-import",
        stdio: "pipe",
      });
      this.child = child;
      const onExit = () => {
        this.failAll(new Error("素材导入进程已退出"));
        this.child = null;
        this.ready = null;
      };
      child.once("exit", onExit);
      child.on("message", (message: WorkerResponse) => {
        if ("ready" in message && message.ready) {
          resolve();
          return;
        }
        if (!("id" in message)) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error));
      });
      child.stderr?.on("data", (chunk) => log.warn("mediaImportWorker", String(chunk)));
      // utilityProcess.fork is only valid after ready; callers already await app ready.
      if (!app.isReady()) reject(new Error("app not ready"));
    });
    return this.ready;
  }

  private request(paths: string[], kind: ContentKind) {
    return new Promise<LocalImportResult>((resolve, reject) => {
      if (!this.child) {
        reject(new Error("素材导入进程未启动"));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.child.postMessage({ id, paths, kind });
    });
  }

  private failAll(error: Error) {
    for (const [, pending] of this.pending) pending.reject(error);
    this.pending.clear();
  }
}

let shared: MediaImportHost | null = null;

export function mediaImportHost() {
  if (!shared) shared = new MediaImportHost();
  return shared;
}

export function disposeMediaImportHost() {
  shared?.dispose();
  shared = null;
}
