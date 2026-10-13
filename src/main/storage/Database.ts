import Sqlite from "better-sqlite3";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Account, Task, Target, TaskTarget, Status } from "../../shared/models";
import * as schema from "./schema";
import type { DraftImage } from "./schema";

export class Database {
  private readonly db: Sqlite.Database;
  private readonly orm: BetterSQLite3Database<typeof schema>;
  private targetListeners = new Set<(target: TaskTarget) => void>();

  // Electron passes its packaged resource path explicitly; the default is for repository tests.
  constructor(path: string, migrationsFolder = resolve("drizzle")) {
    this.db = new Sqlite(path);
    this.orm = drizzle(this.db, { schema });
    try {
      this.db.pragma("foreign_keys = ON");
      this.db.pragma("journal_mode = WAL");
      if (this.schemaVersion() > 3) throw new Error("数据库版本高于当前应用，不能降级读取");
      const migrations = readMigrationFiles({ migrationsFolder });
      if (!migrations.length) throw new Error("数据库迁移文件缺失");
      const journal = this.orm.get(
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
      );
      if (journal) {
        const latest = this.orm.get<{ createdAt: number | null }>(
          sql`SELECT MAX(created_at) AS createdAt FROM __drizzle_migrations`,
        );
        if (latest?.createdAt && latest.createdAt > migrations.at(-1)!.folderMillis)
          throw new Error("数据库版本高于当前应用，不能降级读取");
      }
      migrate(this.orm, { migrationsFolder });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  setting(key: string): unknown {
    const row = this.orm.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  setSetting(key: string, value: unknown) {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("设置值不能为 undefined");
    this.orm
      .insert(schema.settings)
      .values({ key, value: encoded })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: encoded },
      })
      .run();
  }
  deleteSetting(key: string) {
    this.orm.delete(schema.settings).where(eq(schema.settings.key, key)).run();
  }
  deleteAccount(id: string) {
    this.account(id);
    if (
      this.targets().some(
        (target) =>
          target.accountId === id &&
          ["pending", "running", "awaiting_user", "submitted"].includes(target.status),
      )
    )
      throw new Error("该账号仍有未完成的发布，完成后再删除");
    const targetIds = this.targets()
      .filter((target) => target.accountId === id)
      .map((target) => target.id);
    this.orm.transaction((tx) => {
      for (const targetId of targetIds)
        tx.delete(schema.attempts).where(eq(schema.attempts.targetId, targetId)).run();
      tx.delete(schema.targets).where(eq(schema.targets.accountId, id)).run();
      const referenced = new Set(
        tx
          .select()
          .from(schema.targets)
          .all()
          .map((target) => target.taskId),
      );
      for (const task of tx.select().from(schema.tasks).all()) {
        if (!referenced.has(task.id))
          tx.delete(schema.tasks).where(eq(schema.tasks.id, task.id)).run();
      }
      tx.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
    });
    this.deleteSetting(`avatar:${id}`);
    this.deleteSetting(`identities:${id}`);
    this.deleteSetting(`account-status:${id}`);
    for (const targetId of targetIds) this.deleteSetting(`publish-evidence:${targetId}`);
    const session = this.setting("workspaceSession") as {
      tabs?: { id: string; kind?: string }[];
      activeId?: string | null;
      page?: string;
    } | null;
    if (session && Array.isArray(session.tabs)) {
      this.setSetting("workspaceSession", {
        ...session,
        tabs: session.tabs.filter((tab) => tab.id !== id),
        activeId: session.activeId === id ? null : (session.activeId ?? null),
      });
    }
  }
  onTargetChange(listener: (target: TaskTarget) => void) {
    this.targetListeners.add(listener);
    return () => {
      this.targetListeners.delete(listener);
    };
  }
  schemaVersion() {
    return this.db.pragma("user_version", { simple: true }) as number;
  }
  accounts(): Account[] {
    return this.orm
      .select()
      .from(schema.accounts)
      .orderBy(sql`rowid`)
      .all();
  }
  addAccount(name: string) {
    if (!name.trim()) throw new Error("请输入账号名称");
    const account = { id: randomUUID(), name: name.trim() };
    this.orm.insert(schema.accounts).values(account).run();
    return account;
  }
  account(id: string): Account {
    const account = this.orm.select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
    if (!account) throw new Error("账号不存在");
    return account;
  }
  saveDraft(body: string, images: DraftImage[]) {
    this.orm
      .insert(schema.drafts)
      .values({ id: 1, body, images })
      .onConflictDoUpdate({
        target: schema.drafts.id,
        set: { body, images },
      })
      .run();
  }
  draft(): { body: string; images: DraftImage[] } {
    const draft = this.orm
      .select({ body: schema.drafts.body, images: schema.drafts.images })
      .from(schema.drafts)
      .where(eq(schema.drafts.id, 1))
      .get();
    return draft ?? { body: "", images: [] };
  }
  createTask(body: string, images: string[], targets: Target[]): Task {
    if (!body.trim() || !targets.length) throw new Error("需要正文和至少一个目标");
    const keys = new Set(targets.map((target) => `${target.accountId}:${target.identityId}`));
    if (keys.size !== targets.length) throw new Error("目标重复");
    const task: Task = { id: randomUUID(), body, images, createdAt: new Date().toISOString() };
    this.orm.transaction((tx) => {
      tx.insert(schema.tasks).values(task).run();
      for (const target of targets) {
        if (!/^[0-9]+$/.test(target.identityId)) throw new Error("目标身份 ID 无效");
        tx.insert(schema.targets)
          .values({
            ...target,
            id: randomUUID(),
            taskId: task.id,
            status: "pending",
          })
          .run();
      }
    });
    return task;
  }
  tasks(): Task[] {
    return this.orm.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt)).all();
  }
  targets(taskId?: string): TaskTarget[] {
    return this.orm
      .select()
      .from(schema.targets)
      .where(taskId ? eq(schema.targets.taskId, taskId) : undefined)
      .all();
  }
  transition(id: string, status: Status, error: string | null = null, url: string | null = null) {
    const previous = this.orm
      .select({ status: schema.targets.status })
      .from(schema.targets)
      .where(eq(schema.targets.id, id))
      .get();
    this.orm
      .update(schema.targets)
      .set({ status, error, url })
      .where(eq(schema.targets.id, id))
      .run();
    if (!previous || previous.status === status) return;
    const target = this.orm.select().from(schema.targets).where(eq(schema.targets.id, id)).get()!;
    for (const listener of this.targetListeners) {
      try {
        listener(target);
      } catch (error) {
        console.warn("任务状态监听失败:", error);
      }
    }
  }
  startAttempt(id: string) {
    const attempt = randomUUID();
    this.orm.transaction((tx) => {
      this.transition(id, "running");
      tx.insert(schema.attempts)
        .values({
          id: attempt,
          targetId: id,
          startedAt: new Date().toISOString(),
          status: "running",
        })
        .run();
    });
    return attempt;
  }
  finishAttempt(
    id: string,
    status: Status,
    error: string | null = null,
    url: string | null = null,
  ) {
    this.orm
      .update(schema.attempts)
      .set({ status, error, url })
      .where(eq(schema.attempts.id, id))
      .run();
  }
  recover() {
    this.orm.transaction((tx) => {
      tx.update(schema.targets)
        .set({ status: "unknown", error: "应用中断，发布未完成" })
        .where(eq(schema.targets.status, "running"))
        .run();
      tx.update(schema.attempts)
        .set({ status: "unknown" })
        .where(eq(schema.attempts.status, "running"))
        .run();
      for (const target of tx.select().from(schema.targets).all()) {
        if (!target.error || (target.status !== "unknown" && target.status !== "submitted"))
          continue;
        if (!/未点击发布|未再次点击/.test(target.error)) continue;
        tx.update(schema.targets)
          .set({ status: "failed", error: target.error.replace(/；?请人工核验/g, "") })
          .where(eq(schema.targets.id, target.id))
          .run();
      }
    });
  }
  retry(id: string) {
    const row = this.orm.select().from(schema.targets).where(eq(schema.targets.id, id)).get();
    if (row?.status !== "failed") throw new Error("仅明确失败项允许重试");
    this.transition(id, "pending");
  }
  close() {
    this.targetListeners.clear();
    this.db.close();
  }
}
