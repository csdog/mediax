import Sqlite from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Account, Task, Target, TaskTarget, Status } from "../../shared/models";
export class Database {
  private db: Sqlite.Database;
  private targetListeners = new Set<(target: TaskTarget) => void>();
  constructor(path: string) {
    this.db = new Sqlite(path);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    const version = this.schemaVersion();
    if (version > 2) throw new Error("数据库版本高于当前应用，不能降级读取");
    if (version === 0)
      this.db.transaction(() => {
        this.db.exec(`
   CREATE TABLE accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE drafts(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL,images TEXT NOT NULL);
   CREATE TABLE tasks(id TEXT PRIMARY KEY,body TEXT NOT NULL,images TEXT NOT NULL,createdAt TEXT NOT NULL);
   CREATE TABLE targets(id TEXT PRIMARY KEY,taskId TEXT NOT NULL REFERENCES tasks(id),accountId TEXT NOT NULL REFERENCES accounts(id),identityId TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,error TEXT,url TEXT);
   CREATE TABLE attempts(id TEXT PRIMARY KEY,targetId TEXT NOT NULL REFERENCES targets(id),startedAt TEXT NOT NULL,status TEXT NOT NULL,error TEXT,url TEXT);
   PRAGMA user_version=1;
  `);
      })();
    if (version < 2)
      this.db.transaction(() => {
        this.db.exec(
          "CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version=2;",
        );
      })();
  }
  setting(key: string): unknown {
    const row = this.db.prepare("SELECT value FROM settings WHERE key=?").get(key) as
      | { value: string }
      | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  setSetting(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
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
  accounts() {
    return this.db.prepare("SELECT * FROM accounts ORDER BY rowid").all() as Account[];
  }
  addAccount(name: string) {
    if (!name.trim()) throw new Error("请输入账号名称");
    const a = { id: randomUUID(), name: name.trim() };
    this.db.prepare("INSERT INTO accounts VALUES (@id,@name)").run(a);
    return a;
  }
  account(id: string) {
    const a = this.db.prepare("SELECT * FROM accounts WHERE id=?").get(id) as Account | undefined;
    if (!a) throw new Error("账号不存在");
    return a;
  }
  saveDraft(body: string, images: unknown[]) {
    this.db
      .prepare(
        "INSERT INTO drafts VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,images=excluded.images",
      )
      .run(body, JSON.stringify(images));
  }
  draft() {
    const d = this.db.prepare("SELECT body,images FROM drafts WHERE id=1").get() as
      | { body: string; images: string }
      | undefined;
    return d ? { body: d.body, images: JSON.parse(d.images) } : { body: "", images: [] };
  }
  createTask(body: string, images: string[], targets: Target[]): Task {
    if (!body.trim() || !targets.length) throw new Error("需要正文和至少一个目标");
    const keys = new Set(targets.map((t) => `${t.accountId}:${t.identityId}`));
    if (keys.size !== targets.length) throw new Error("目标重复");
    const task = {
      id: randomUUID(),
      body,
      images,
      createdAt: new Date().toISOString(),
    };
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO tasks VALUES (?,?,?,?)")
        .run(task.id, body, JSON.stringify(images), task.createdAt);
      const insert = this.db.prepare("INSERT INTO targets VALUES (?,?,?,?,?,?,?,NULL,NULL)");
      for (const t of targets) {
        if (!/^[0-9]+$/.test(t.identityId)) throw new Error("目标身份 ID 无效");
        insert.run(randomUUID(), task.id, t.accountId, t.identityId, t.name, t.kind, "pending");
      }
    })();
    return task;
  }
  tasks() {
    return (
      this.db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all() as (Omit<
        Task,
        "images"
      > & { images: string })[]
    ).map((t) => ({ ...t, images: JSON.parse(t.images) }));
  }
  targets(taskId?: string) {
    return (
      taskId
        ? this.db.prepare("SELECT * FROM targets WHERE taskId=?").all(taskId)
        : this.db.prepare("SELECT * FROM targets").all()
    ) as TaskTarget[];
  }
  transition(id: string, status: Status, error: string | null = null, url: string | null = null) {
    const previous = this.db.prepare("SELECT status FROM targets WHERE id=?").get(id) as
      | { status: Status }
      | undefined;
    this.db
      .prepare("UPDATE targets SET status=?,error=?,url=? WHERE id=?")
      .run(status, error, url, id);
    if (!previous || previous.status === status) return;
    const target = this.db.prepare("SELECT * FROM targets WHERE id=?").get(id) as TaskTarget;
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
    this.db.transaction(() => {
      this.transition(id, "running");
      this.db
        .prepare("INSERT INTO attempts VALUES (?,?,?,?,NULL,NULL)")
        .run(attempt, id, new Date().toISOString(), "running");
    })();
    return attempt;
  }
  finishAttempt(
    id: string,
    status: Status,
    error: string | null = null,
    url: string | null = null,
  ) {
    this.db
      .prepare("UPDATE attempts SET status=?,error=?,url=? WHERE id=?")
      .run(status, error, url, id);
  }
  recover() {
    this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE targets SET status='unknown',error='应用中断，请先人工核验是否已发布' WHERE status='running'",
        )
        .run();
      this.db.prepare("UPDATE attempts SET status='unknown' WHERE status='running'").run();
    })();
  }
  retry(id: string) {
    const row = this.targets().find((t) => t.id === id);
    if (row?.status !== "failed") throw new Error("仅明确失败项允许重试");
    this.transition(id, "pending");
  }
  close() {
    this.targetListeners.clear();
    this.db.close();
  }
}
