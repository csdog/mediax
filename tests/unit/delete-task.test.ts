import { describe, expect, it } from "vitest";
import { Database } from "../../src/main/storage/Database";
import type { Status } from "../../src/shared/models";

function fixture() {
  const db = new Database(":memory:");
  const account = db.addAccount("发布账号");
  const target = { accountId: account.id, identityId: "1", name: "主页", kind: "profile" as const };
  return { db, account, target };
}

describe("delete publish record", () => {
  it("removes all targets, attempts and evidence while retaining other records and accounts", () => {
    const { db, account, target } = fixture();
    try {
      const task = db.createTask("删除的记录", [], [target, { ...target, identityId: "2" }]);
      const other = db.createTask("保留的记录", [], [target]);
      const targets = db.targets(task.id);
      for (const item of targets) {
        const attempt = db.startAttempt(item.id);
        db.transition(item.id, "verified");
        db.finishAttempt(attempt, "verified");
        db.setSetting(`publish-evidence:${item.id}`, { text: "evidence" });
      }
      db.deleteTask(task.id);
      expect(db.tasks().map((item) => item.id)).toEqual([other.id]);
      expect(db.targets()).toHaveLength(1);
      expect(db.accounts()).toEqual([account]);
      for (const item of targets) expect(db.setting(`publish-evidence:${item.id}`)).toBeNull();
      expect(() => db.deleteTask(task.id)).toThrow("任务不存在");
    } finally {
      db.close();
    }
  });

  it.each<Status>(["pending", "running", "awaiting_user", "submitted"])(
    "rejects deletion of %s tasks without changing data",
    (status) => {
      const { db, target } = fixture();
      try {
        const task = db.createTask("未完成记录", [], [target]);
        db.transition(db.targets(task.id)[0].id, status);
        expect(() => db.deleteTask(task.id)).toThrow("未完成的发布");
        expect(db.tasks()).toHaveLength(1);
        expect(db.targets(task.id)[0].status).toBe(status);
      } finally {
        db.close();
      }
    },
  );

  it("removes scheduled tasks before they can enter the publish queue", () => {
    const { db, target } = fixture();
    try {
      const when = new Date(Date.now() + 60_000);
      const task = db.createTask("已排期", [], [target], { scheduledAt: when.toISOString() });
      db.deleteTask(task.id);
      expect(db.promoteDueScheduled(new Date(when.getTime() + 1))).toEqual([]);
      expect(db.targets()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
