import { afterEach, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Sqlite from "better-sqlite3";
import { Database } from "../../src/main/storage/Database";

const directories: string[] = [];
const draftImages = [{ path: "/tmp/中文.png", name: "中文.png" }];
const windowState = { x: 100, y: 100, width: 1100, height: 740, maximized: false };
function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "media-post-drizzle-"));
  directories.push(directory);
  return { directory, file: join(directory, "app.sqlite") };
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function legacyDatabase(file: string, version: 1 | 2) {
  const sqlite = new Sqlite(file);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(readFileSync(resolve("tests/fixtures/legacy-v1.sql"), "utf8"));
  sqlite.prepare("INSERT INTO accounts VALUES (?, ?)").run("legacy-account", "Existing account");
  sqlite
    .prepare("INSERT INTO drafts VALUES (1, ?, ?)")
    .run("Existing draft 中文", JSON.stringify(draftImages));
  sqlite
    .prepare("INSERT INTO tasks VALUES (?, ?, ?, ?)")
    .run(
      "legacy-task",
      "Article 中文",
      JSON.stringify(["/tmp/中文.png"]),
      "2026-10-01T00:00:00.000Z",
    );
  sqlite
    .prepare("INSERT INTO targets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "legacy-target",
      "legacy-task",
      "legacy-account",
      "123",
      "Page",
      "page",
      "verified",
      null,
      "https://www.facebook.com/123/posts/456",
    );
  sqlite
    .prepare("INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      "legacy-attempt",
      "legacy-target",
      "2026-10-01T00:00:00.000Z",
      "verified",
      null,
      "https://www.facebook.com/123/posts/456",
    );
  if (version === 2) {
    sqlite.exec(
      "CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version=2;",
    );
    sqlite
      .prepare("INSERT INTO settings VALUES (?, ?)")
      .run("mainWindow", JSON.stringify(windowState));
    sqlite
      .prepare("INSERT INTO settings VALUES (?, ?)")
      .run("globalShortcut", JSON.stringify("Alt+M"));
  }
  sqlite.close();
}

it.each([1, 2] as const)(
  "adopts the real legacy v%i schema without losing business data and migrates only once",
  (version) => {
    const { file } = temporaryDatabase();
    legacyDatabase(file, version);
    const db = new Database(file);
    try {
      expect(db.schemaVersion()).toBe(4);
      expect(db.accounts()).toEqual([
        { id: "legacy-account", name: "Existing account", platform: "facebook" },
      ]);
      expect(db.draft()).toEqual({ body: "Existing draft 中文", images: draftImages });
      expect(db.tasks()[0]).toMatchObject({
        id: "legacy-task",
        body: "Article 中文",
        images: ["/tmp/中文.png"],
      });
      expect(db.targets("legacy-task")[0]).toMatchObject({
        status: "verified",
        kind: "page",
        url: "https://www.facebook.com/123/posts/456",
      });
      expect(db.setting("mainWindow")).toEqual(version === 2 ? windowState : null);
      if (version === 2) expect(db.setting("globalShortcut")).toBe("Alt+M");
      db.setSetting("mainWindow", windowState);
      db.setSetting("mainWindow", { ...windowState, width: 1200 });
      db.saveDraft("Updated draft", draftImages);
    } finally {
      db.close();
    }
    const reopened = new Database(file);
    try {
      expect(reopened.setting("mainWindow")).toMatchObject({ width: 1200, height: 740 });
      expect(reopened.draft()).toEqual({ body: "Updated draft", images: draftImages });
      expect(() => reopened.retry("legacy-target")).toThrow("仅明确失败项允许重试");
    } finally {
      reopened.close();
    }
    const sqlite = new Sqlite(file);
    try {
      expect(sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get()).toEqual({
        count: 2,
      });
      expect(
        sqlite.prepare("SELECT status, url FROM attempts WHERE id='legacy-attempt'").get(),
      ).toEqual({ status: "verified", url: "https://www.facebook.com/123/posts/456" });
      expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    } finally {
      sqlite.close();
    }
  },
);

it("rejects future legacy versions and future Drizzle migrations", () => {
  const { file } = temporaryDatabase();
  const db = new Database(file);
  db.addAccount("Preserve me");
  db.close();
  const sqlite = new Sqlite(file);
  sqlite.pragma("user_version=5");
  sqlite.close();
  expect(() => new Database(file)).toThrow("不能降级读取");
  const next = new Sqlite(file);
  next.pragma("user_version=4");
  next.prepare("UPDATE __drizzle_migrations SET created_at=created_at+1").run();
  next.close();
  expect(() => new Database(file)).toThrow("不能降级读取");
  const check = new Sqlite(file);
  try {
    expect(check.prepare("SELECT name FROM accounts").all()).toEqual([{ name: "Preserve me" }]);
  } finally {
    check.close();
  }
});

it("rolls back a failed migration without changing legacy data or version", () => {
  const { directory, file } = temporaryDatabase();
  legacyDatabase(file, 1);
  const migrationsFolder = join(directory, "drizzle");
  cpSync(resolve("drizzle"), migrationsFolder, { recursive: true });
  appendFileSync(
    join(migrationsFolder, "0000_legacy_baseline.sql"),
    "\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);\n",
  );
  expect(() => new Database(file, migrationsFolder)).toThrow();
  const sqlite = new Sqlite(file);
  try {
    expect(sqlite.pragma("user_version", { simple: true })).toBe(1);
    expect(sqlite.prepare("SELECT name FROM accounts").all()).toEqual([
      { name: "Existing account" },
    ]);
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name='settings'").get(),
    ).toBeUndefined();
    expect(sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get()).toEqual({
      count: 0,
    });
  } finally {
    sqlite.close();
  }
  const recovered = new Database(file);
  try {
    expect(recovered.draft().body).toBe("Existing draft 中文");
  } finally {
    recovered.close();
  }
});

it("keeps transaction rollback, attempt recovery and corrupt setting handling with ORM queries", () => {
  const { file } = temporaryDatabase();
  const db = new Database(file);
  try {
    const account = db.addAccount("A");
    const target = {
      accountId: account.id,
      identityId: "123",
      name: "Profile",
      kind: "profile" as const,
    };
    expect(() =>
      db.createTask("rollback", [], [target, { ...target, identityId: "invalid" }]),
    ).toThrow("身份 ID 无效");
    expect(db.tasks()).toEqual([]);
    expect(db.targets()).toEqual([]);
    const task = db.createTask("Publish", ["/tmp/中文.png"], [target]);
    const id = db.targets(task.id)[0].id;
    const attempt = db.startAttempt(id);
    db.finishAttempt(attempt, "running", "interrupted");
    db.recover();
    expect(db.targets(task.id)[0]).toMatchObject({
      status: "unknown",
      error: "应用中断，发布未完成",
    });
    expect(() => db.retry(id)).toThrow();
  } finally {
    db.close();
  }
  const sqlite = new Sqlite(file);
  sqlite.prepare("INSERT INTO settings VALUES ('corrupt', 'not JSON')").run();
  try {
    expect(sqlite.prepare("SELECT status FROM attempts").all()).toEqual([{ status: "unknown" }]);
  } finally {
    sqlite.close();
  }
  const reopened = new Database(file);
  try {
    expect(reopened.setting("corrupt")).toBeNull();
  } finally {
    reopened.close();
  }
});
