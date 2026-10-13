import { expect, it } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { taskDockSnapshot } from "../../src/main/desktop/TaskDockStatus";

it("summarizes awaiting badge count and in-flight progress", () => {
  const db = new Database(":memory:");
  const account = db.addAccount("A");
  db.createTask(
    "body",
    [],
    [1, 2].map((id) => ({
      accountId: account.id,
      identityId: String(id),
      name: `Target ${id}`,
      kind: "profile" as const,
    })),
  );
  const targets = db.targets();
  expect(taskDockSnapshot(targets)).toEqual({
    awaiting: 0,
    progress: 0,
    needsAttention: false,
  });
  db.transition(targets[0].id, "awaiting_user");
  expect(taskDockSnapshot(db.targets())).toEqual({
    awaiting: 1,
    progress: 0,
    needsAttention: true,
  });
  db.transition(targets[0].id, "verified");
  expect(taskDockSnapshot(db.targets()).progress).toBe(0.5);
  db.transition(targets[1].id, "verified");
  expect(taskDockSnapshot(db.targets())).toEqual({
    awaiting: 0,
    progress: -1,
    needsAttention: false,
  });
  db.close();
});
