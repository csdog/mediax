import { describe, it, expect } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { AccountService } from "../../src/main/accounts/AccountService";
import { AccountBrowserManager } from "../../src/main/browser/AccountBrowserManager";
describe("SQLite storage", () => {
  it("migrates and isolates accounts", () => {
    const db = new Database(":memory:");
    const a = db.addAccount("A"),
      b = db.addAccount("B");
    expect(a.id).not.toBe(b.id);
    expect(db.accounts()).toHaveLength(2);
    expect(db.schemaVersion()).toBe(5);
    db.close();
  });
  it("rolls back a task with invalid target and enforces foreign keys", () => {
    const db = new Database(":memory:");
    expect(() =>
      db.createTask(
        "body",
        [],
        [
          {
            accountId: "missing",
            identityId: "123",
            name: "A",
            kind: "profile",
          },
        ],
      ),
    ).toThrow();
    expect(db.tasks()).toHaveLength(0);
    db.close();
  });
  it("never retries unknown or successful targets and recovers interrupted work", () => {
    const db = new Database(":memory:");
    const a = db.addAccount("A");
    const task = db.createTask(
      "text",
      [],
      [{ accountId: a.id, identityId: "123", name: "A", kind: "profile" }],
    );
    const t = db.targets(task.id)[0];
    db.transition(t.id, "running");
    db.recover();
    expect(db.targets(task.id)[0].status).toBe("unknown");
    expect(() => db.retry(t.id)).toThrow();
    db.close();
  });
  it("restores saved login status and deletes an account after its publish records", async () => {
    const db = new Database(":memory:");
    const accounts = new AccountService(db, new AccountBrowserManager());
    const account = db.addAccount("A");
    const target = {
      accountId: account.id,
      identityId: "1001",
      name: "A",
      kind: "profile" as const,
    };
    db.setSetting(`identities:${account.id}`, { owner: "1001", targets: [target] });
    db.setSetting(`account-status:${account.id}`, {
      login: "logged_in",
      message: "已识别 1 个发布身份。",
      targets: [target],
    });
    expect(accounts.list()[0]).toMatchObject({
      login: "logged_in",
      message: "已识别 1 个发布身份。",
      targets: [target],
    });
    const task = db.createTask("text", [], [target]);
    expect(() => db.deleteAccount(account.id)).toThrow(/未完成的发布/);
    db.transition(db.targets(task.id)[0].id, "verified");
    await accounts.remove(account.id);
    expect(db.accounts()).toHaveLength(0);
    expect(db.targets()).toHaveLength(0);
    expect(db.tasks()).toHaveLength(0);
    expect(accounts.list()).toHaveLength(0);
    accounts.stopAutoRefresh();
    db.close();
  });

  it("persists logged_out for every account after clearing browser sessions", async () => {
    const db = new Database(":memory:");
    const accounts = new AccountService(db, new AccountBrowserManager());
    const loaded = db.addAccount("Loaded");
    const unloaded = db.addAccount("Unloaded", "zhihu");
    const target = {
      accountId: loaded.id,
      identityId: "1001",
      name: "Loaded",
      kind: "profile" as const,
    };
    db.setSetting(`account-status:${loaded.id}`, {
      login: "logged_in",
      message: "已识别 1 个发布身份。",
      targets: [target],
    });
    db.setSetting(`account-status:${unloaded.id}`, {
      login: "logged_in",
      message: "已登录",
      targets: [],
    });
    expect(accounts.list().find((item) => item.id === loaded.id)?.login).toBe("logged_in");
    await accounts.clearAllBrowserSessions();
    expect(accounts.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: loaded.id,
          login: "logged_out",
          message: "已清理浏览器会话，请重新登录",
        }),
        expect.objectContaining({
          id: unloaded.id,
          login: "logged_out",
          message: "已清理浏览器会话，请重新登录",
        }),
      ]),
    );
    accounts.stopAutoRefresh();
    const restored = new AccountService(db, new AccountBrowserManager());
    expect(restored.list().every((item) => item.login === "logged_out")).toBe(true);
    restored.stopAutoRefresh();
    db.close();
  });
});
