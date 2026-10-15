import Sqlite from "better-sqlite3";
import { and, desc, eq, gt, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { inferContentKind } from "../../shared/content";
import {
  isPlatform,
  type Account,
  type AnalyticsSummary,
  type CalendarEntry,
  type ContentKind,
  type PlatformId,
  type Task,
  type Target,
  type TaskTarget,
  type Status,
} from "../../shared/models";
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
      if (this.schemaVersion() > 6) throw new Error("数据库版本高于当前应用，不能降级读取");
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
  addAccount(name: string, platform: PlatformId = "facebook") {
    if (!name.trim()) throw new Error("请输入账号名称");
    if (!isPlatform(platform)) throw new Error("暂不支持该平台");
    const account: Account = { id: randomUUID(), name: name.trim(), platform };
    this.orm.insert(schema.accounts).values(account).run();
    return account;
  }
  renameAccount(id: string, name: string) {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) throw new Error("请输入账号名称");
    this.account(id);
    this.orm.update(schema.accounts).set({ name: trimmed }).where(eq(schema.accounts.id, id)).run();
    return this.account(id);
  }
  account(id: string): Account {
    const account = this.orm.select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
    if (!account) throw new Error("账号不存在");
    return account;
  }
  saveDraft(
    body: string,
    images: DraftImage[],
    contentKind: ContentKind = inferContentKind(images.map((image) => image.path)),
    title: string | null = null,
  ) {
    this.orm
      .insert(schema.drafts)
      .values({ id: 1, contentKind, title, body, images })
      .onConflictDoUpdate({
        target: schema.drafts.id,
        set: { contentKind, title, body, images },
      })
      .run();
  }
  draft(): { body: string; images: DraftImage[]; contentKind: ContentKind; title: string | null } {
    const draft = this.orm
      .select({
        body: schema.drafts.body,
        images: schema.drafts.images,
        contentKind: schema.drafts.contentKind,
        title: schema.drafts.title,
      })
      .from(schema.drafts)
      .where(eq(schema.drafts.id, 1))
      .get();
    return draft ?? { body: "", images: [], contentKind: "article", title: null };
  }
  createTask(
    body: string,
    images: string[],
    targets: Target[],
    meta?: { contentKind?: ContentKind; title?: string | null; scheduledAt?: string | null },
  ): Task {
    const contentKind = meta?.contentKind ?? inferContentKind(images);
    const needsBody = contentKind === "article" || contentKind === "moment";
    if ((needsBody && !body.trim()) || !targets.length) throw new Error("需要正文和至少一个目标");
    const keys = new Set(targets.map((target) => `${target.accountId}:${target.identityId}`));
    if (keys.size !== targets.length) throw new Error("目标重复");
    const scheduledAt = normalizeScheduledAt(meta?.scheduledAt);
    const initialStatus: Status = scheduledAt ? "scheduled" : "pending";
    const task: Task = {
      id: randomUUID(),
      contentKind,
      title: meta?.title ?? null,
      body,
      images,
      createdAt: new Date().toISOString(),
      scheduledAt,
    };
    const createdTargets: TaskTarget[] = [];
    this.orm.transaction((tx) => {
      tx.insert(schema.tasks).values(task).run();
      for (const target of targets) {
        if (!/^[0-9]+$/.test(target.identityId)) throw new Error("目标身份 ID 无效");
        const row: TaskTarget = {
          ...target,
          id: randomUUID(),
          taskId: task.id,
          status: initialStatus,
          error: null,
          url: null,
        };
        tx.insert(schema.targets).values(row).run();
        createdTargets.push(row);
      }
    });
    for (const target of createdTargets) {
      for (const listener of this.targetListeners) {
        try {
          listener(target);
        } catch (error) {
          console.warn("任务状态监听失败:", error);
        }
      }
    }
    return task;
  }
  task(id: string): Task {
    const row = this.orm.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get();
    if (!row) throw new Error("任务不存在");
    return row;
  }
  tasks(): Task[] {
    return this.orm.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt)).all();
  }
  /** Promote due scheduled targets to pending. Returns promoted task ids. */
  promoteDueScheduled(now = new Date()): string[] {
    const iso = now.toISOString();
    const due = this.orm
      .select()
      .from(schema.tasks)
      .where(and(isNotNull(schema.tasks.scheduledAt), lte(schema.tasks.scheduledAt, iso)))
      .all()
      .filter((task) => this.targets(task.id).some((t) => t.status === "scheduled"));
    const promoted: string[] = [];
    for (const task of due) {
      for (const target of this.targets(task.id).filter((t) => t.status === "scheduled")) {
        this.transition(target.id, "pending");
      }
      promoted.push(task.id);
    }
    return promoted;
  }
  nextScheduledAt(now = new Date()): string | null {
    const iso = now.toISOString();
    const upcoming = this.orm
      .select()
      .from(schema.tasks)
      .where(and(isNotNull(schema.tasks.scheduledAt), gt(schema.tasks.scheduledAt, iso)))
      .all()
      .filter((task) => this.targets(task.id).some((t) => t.status === "scheduled"))
      .map((task) => task.scheduledAt!)
      .sort();
    return upcoming[0] ?? null;
  }
  rescheduleTask(taskId: string, scheduledAtRaw: string): Task {
    const scheduledAt = normalizeScheduledAt(scheduledAtRaw);
    if (!scheduledAt) throw new Error("请选择有效的定时时间");
    const task = this.task(taskId);
    const targets = this.targets(taskId);
    if (!targets.length) throw new Error("任务没有发布目标");
    if (!targets.every((t) => t.status === "scheduled"))
      throw new Error("仅等待排期的任务可以改期");
    this.orm.update(schema.tasks).set({ scheduledAt }).where(eq(schema.tasks.id, taskId)).run();
    return { ...task, scheduledAt };
  }
  calendarEntries(fromIso: string, toIso: string): CalendarEntry[] {
    const tasks = this.orm
      .select()
      .from(schema.tasks)
      .where(
        or(
          and(
            isNotNull(schema.tasks.scheduledAt),
            gte(schema.tasks.scheduledAt, fromIso),
            lte(schema.tasks.scheduledAt, toIso),
          ),
          and(gte(schema.tasks.createdAt, fromIso), lte(schema.tasks.createdAt, toIso)),
        ),
      )
      .all();
    const entries: CalendarEntry[] = [];
    for (const task of tasks) {
      const targets = this.targets(task.id);
      const when = task.scheduledAt ?? task.createdAt;
      if (when < fromIso || when > toIso) continue;
      entries.push({ task, targets, when });
    }
    return entries.sort((a, b) => a.when.localeCompare(b.when));
  }
  analyticsSummary(days = 30): AnalyticsSummary {
    const span = Math.min(90, Math.max(1, Math.floor(days)));
    const sinceDate = new Date();
    sinceDate.setHours(0, 0, 0, 0);
    sinceDate.setDate(sinceDate.getDate() - (span - 1));
    const since = sinceDate.toISOString();
    const tasks = this.tasks().filter((task) => (task.scheduledAt ?? task.createdAt) >= since);
    const taskIds = new Set(tasks.map((t) => t.id));
    const allTargets = this.targets().filter((t) => taskIds.has(t.taskId));
    const accounts = this.accounts();
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const totals = {
      tasks: tasks.length,
      targets: allTargets.length,
      verified: allTargets.filter((t) => t.status === "verified").length,
      failed: allTargets.filter((t) => t.status === "failed").length,
      awaitingUser: allTargets.filter((t) => t.status === "awaiting_user").length,
      scheduled: allTargets.filter((t) => t.status === "scheduled").length,
      pendingOrRunning: allTargets.filter((t) => ["pending", "running"].includes(t.status)).length,
    };
    const decided = totals.verified + totals.failed;
    const successRate = decided ? totals.verified / decided : null;
    const byPlatformMap = new Map<
      PlatformId,
      { platform: PlatformId; targets: number; verified: number; failed: number }
    >();
    const byAccountMap = new Map<
      string,
      {
        accountId: string;
        name: string;
        platform: PlatformId;
        targets: number;
        verified: number;
        failed: number;
      }
    >();
    for (const target of allTargets) {
      const account = accountById.get(target.accountId);
      const platform = account?.platform ?? ("facebook" as PlatformId);
      const plat = byPlatformMap.get(platform) ?? {
        platform,
        targets: 0,
        verified: 0,
        failed: 0,
      };
      plat.targets += 1;
      if (target.status === "verified") plat.verified += 1;
      if (target.status === "failed") plat.failed += 1;
      byPlatformMap.set(platform, plat);
      const acc = byAccountMap.get(target.accountId) ?? {
        accountId: target.accountId,
        name: account?.name ?? target.name,
        platform,
        targets: 0,
        verified: 0,
        failed: 0,
      };
      acc.targets += 1;
      if (target.status === "verified") acc.verified += 1;
      if (target.status === "failed") acc.failed += 1;
      byAccountMap.set(target.accountId, acc);
    }
    const dailyMap = new Map<
      string,
      { date: string; tasks: number; verified: number; failed: number }
    >();
    for (let i = 0; i < span; i++) {
      const d = new Date(sinceDate);
      d.setDate(sinceDate.getDate() + i);
      const date = d.toISOString().slice(0, 10);
      dailyMap.set(date, { date, tasks: 0, verified: 0, failed: 0 });
    }
    for (const task of tasks) {
      const date = (task.scheduledAt ?? task.createdAt).slice(0, 10);
      const row = dailyMap.get(date);
      if (!row) continue;
      row.tasks += 1;
      const targets = this.targets(task.id);
      row.verified += targets.filter((t) => t.status === "verified").length;
      row.failed += targets.filter((t) => t.status === "failed").length;
    }
    return {
      days: span,
      since,
      totals,
      successRate,
      byPlatform: [...byPlatformMap.values()].sort((a, b) => b.targets - a.targets),
      byAccount: [...byAccountMap.values()].sort((a, b) => b.targets - a.targets),
      daily: [...dailyMap.values()],
    };
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

function normalizeScheduledAt(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("定时时间无效");
  if (date.getTime() <= Date.now() + 15_000) throw new Error("定时时间须晚于当前至少约 15 秒");
  return date.toISOString();
}
