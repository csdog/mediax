import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Target } from "../../shared/models";
import { Database } from "../storage/Database";
import { AccountService } from "../accounts/AccountService";
import { PublishQueue } from "./PublishQueue";

export class PublishService {
  private queue: PublishQueue;
  private running: Promise<void> | null = null;
  private creating = false;
  constructor(
    private db: Database,
    private accounts: AccountService,
    private assetsDirectory: string,
  ) {
    this.queue = new PublishQueue(db, (target) => accounts.adapter(target.accountId));
  }
  private async execute(work: () => Promise<void>) {
    if (this.running) throw new Error("已有发布任务正在执行");
    const run = this.accounts.exclusive(work);
    this.running = run;
    try {
      await run;
    } finally {
      this.running = null;
    }
  }
  async publish(body: string, paths: string[], selected: Target[]): Promise<string> {
    if (this.creating) throw new Error("正在创建发布任务，请勿重复提交");
    this.creating = true;
    try {
      return await this.create(body, paths, selected);
    } finally {
      this.creating = false;
    }
  }
  private async create(body: string, paths: string[], selected: Target[]): Promise<string> {
    if (!body.trim() || !selected.length) throw new Error("请填写正文并选择发布目标");
    if (this.running) throw new Error("已有发布任务正在执行");
    if (this.db.targets().some((t) => t.status === "awaiting_user" || t.status === "pending"))
      throw new Error("请先在发布记录中处理尚未完成的任务");
    const known = this.accounts.list().flatMap((a) => a.targets);
    const targets = selected.map((t) => {
      const target = known.find(
        (k) => k.accountId === t.accountId && k.identityId === t.identityId && k.kind === t.kind,
      );
      if (!target) throw new Error("发布身份未验证，请重新检查账号状态并选择目标");
      return target;
    });
    if (new Set(targets.map((t) => `${t.accountId}:${t.identityId}`)).size !== targets.length)
      throw new Error("发布目标重复");
    const directory = join(this.assetsDirectory, randomUUID());
    await mkdir(directory, { recursive: true });
    let id: string;
    try {
      const images: string[] = [];
      for (const [index, source] of paths.entries()) {
        const info = await stat(source);
        if (!info.isFile() || info.size > 20 * 1024 * 1024)
          throw new Error("图片不可读或超过 20MB");
        const path = join(directory, `${index}${extname(source).toLowerCase()}`);
        await copyFile(source, path);
        images.push(path);
      }
      id = this.db.createTask(body, images, targets).id;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
    // Queue execution is independent of renderer lifetime; progress is persisted in SQLite.
    void this.execute(() => this.queue.run()).catch((error) => {
      for (const target of this.db.targets(id).filter((t) => t.status === "pending"))
        this.db.transition(
          target.id,
          "failed",
          error instanceof Error ? error.message : String(error),
        );
    });
    return id;
  }
  async retry(id: string) {
    if (this.running) throw new Error("已有发布任务正在执行");
    this.db.retry(id);
    await this.execute(() => this.queue.run());
  }
  async resume(id: string) {
    await this.execute(() => this.queue.resume(id));
  }
  async verify(id: string, url?: string) {
    await this.execute(async () => {
      const target = this.db.targets().find((t) => t.id === id);
      if (!target || !["submitted", "unknown"].includes(target.status))
        throw new Error("该记录无需核验");
      const task = this.db.tasks().find((t) => t.id === target.taskId)!;
      const verifiedUrl = await this.accounts
        .adapter(target.accountId)
        .verifyExisting(task, target, url);
      if (!verifiedUrl)
        throw new Error("未找到唯一匹配的帖子，请在 Facebook 人工核验；不会自动重发");
      this.db.transition(id, "verified", null, verifiedUrl);
    });
  }
}
