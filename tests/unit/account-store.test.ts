import { describe, it, expect } from "vitest";
import { Database } from "../../src/main/storage/Database";
describe("SQLite storage", () => {
  it("migrates and isolates accounts", () => {
    const db = new Database(":memory:");
    const a = db.addAccount("A"),
      b = db.addAccount("B");
    expect(a.id).not.toBe(b.id);
    expect(db.accounts()).toHaveLength(2);
    expect(db.schemaVersion()).toBe(1);
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
});
