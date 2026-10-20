import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { validatePublish } from "../../shared/content";
import { readPublishSettings } from "../../shared/publishSettings";
import type { ContentKind, Target } from "../../shared/models";
import { Database } from "../storage/Database";
import { AccountService } from "../accounts/AccountService";
import { PublishQueue } from "./PublishQueue";
import { ScheduleService } from "./ScheduleService";

export type PublishBatch = {
  title: string | null;
  body: string;
  targets: Target[];
};

export class PublishService {
  private queue: PublishQueue;
  private schedule: ScheduleService;
  private running: Promise<void> | null = null;
  private creating = false;
  constructor(
    private db: Database,
    private accounts: AccountService,
    private assetsDirectory: string,
  ) {
    this.queue = new PublishQueue(
      db,
      (target) => accounts.adapter(target.accountId),
      () => readPublishSettings((key) => db.setting(key)).concurrency,
    );
    this.schedule = new ScheduleService(db, () => {
      void this.queue.run().catch(() => {});
    });
  }
  startScheduler() {
    this.schedule.start();
  }
  stopScheduler() {
    this.schedule.stop();
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
  async publish(
    kind: ContentKind,
    title: string | null,
    body: string,
    paths: string[],
    selected: Target[],
    scheduledAt?: string | null,
  ): Promise<string> {
    return this.publishBatches(kind, paths, [{ title, body, targets: selected }], scheduledAt);
  }
  async publishBatches(
    kind: ContentKind,
    paths: string[],
    batches: PublishBatch[],
    scheduledAt?: string | null,
  ): Promise<string> {
    if (this.creating) throw new Error("正在创建发布任务，请勿重复提交");
    this.creating = true;
    try {
      return await this.createBatches(kind, paths, batches, scheduledAt);
    } finally {
      this.creating = false;
    }
  }
  private async createBatches(
    kind: ContentKind,
    paths: string[],
    batches: PublishBatch[],
    scheduledAt?: string | null,
  ): Promise<string> {
    if (!batches.length || batches.every((batch) => !batch.targets.length))
      throw new Error("请填写正文并选择发布目标");
    if (this.running) throw new Error("已有发布任务正在执行");
    const listed = this.accounts.list();
    const known = listed.flatMap((a) => a.targets);
    const resolved: Array<{ title: string | null; body: string; targets: Target[] }> = [];
    const seen = new Set<string>();
    for (const batch of batches) {
      if (!batch.targets.length) continue;
      const targets = batch.targets.map((t) => {
        const target = known.find(
          (k) => k.accountId === t.accountId && k.identityId === t.identityId && k.kind === t.kind,
        );
        if (!target) throw new Error("发布身份未验证，请重新检查账号状态并选择目标");
        const key = `${target.accountId}:${target.identityId}`;
        if (seen.has(key)) throw new Error("发布目标重复");
        seen.add(key);
        return target;
      });
      validatePublish({
        kind,
        title: batch.title,
        body: batch.body,
        paths,
        platforms: targets.map((target) => {
          const account = listed.find((item) => item.id === target.accountId);
          if (!account) throw new Error("账号不存在");
          return account.platform;
        }),
      });
      resolved.push({ title: batch.title, body: batch.body, targets });
    }
    if (!resolved.length) throw new Error("请填写正文并选择发布目标");

    const createdIds: string[] = [];
    const directories: string[] = [];
    try {
      for (const batch of resolved) {
        const directory = join(this.assetsDirectory, randomUUID());
        await mkdir(directory, { recursive: true });
        directories.push(directory);
        const images: string[] = [];
        for (const [index, source] of paths.entries()) {
          const info = await stat(source);
          if (!info.isFile() || info.size > 20 * 1024 * 1024)
            throw new Error("素材不可读或超过 20MB");
          const path = join(directory, `${index}${extname(source).toLowerCase()}`);
          await copyFile(source, path);
          images.push(path);
        }
        const id = this.db.createTask(batch.body, images, batch.targets, {
          contentKind: kind,
          title: batch.title,
          scheduledAt: scheduledAt ?? null,
        }).id;
        createdIds.push(id);
      }
    } catch (error) {
      // Keep dirs for tasks already inserted; only remove the unfinished copy.
      for (const directory of directories.slice(createdIds.length))
        await rm(directory, { recursive: true, force: true });
      throw error;
    }
    const focusId = createdIds[0]!;
    if (scheduledAt) {
      this.schedule.kick();
      return focusId;
    }
    void this.execute(() => this.queue.run()).catch((error) => {
      for (const id of createdIds) {
        for (const target of this.db.targets(id).filter((t) => t.status === "pending"))
          this.db.transition(
            target.id,
            "failed",
            error instanceof Error ? error.message : String(error),
          );
      }
    });
    return focusId;
  }
  rescheduleTask(taskId: string, scheduledAt: string) {
    const task = this.db.rescheduleTask(taskId, scheduledAt);
    this.schedule.kick();
    return task;
  }
  deleteTask(taskId: string) {
    if (this.running) throw new Error("已有发布任务正在执行，请稍后删除记录");
    this.db.deleteTask(taskId);
  }
  async retry(id: string) {
    if (this.running) throw new Error("已有发布任务正在执行");
    this.db.retry(id);
    await this.execute(() => this.queue.run());
  }
  async republish(id: string) {
    if (this.running) throw new Error("已有发布任务正在执行");
    this.db.republish(id);
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
