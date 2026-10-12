import { it, expect } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { TaskNotifications, type TaskNotice } from "../../src/main/desktop/TaskNotifications";
import { restoreWindowState } from "../../src/main/desktop/windowState";

it("restores a window on visible displays and handles removed monitors and corrupt settings", () => {
  const areas = [{ x: 0, y: 25, width: 1440, height: 875 }];
  expect(
    restoreWindowState({ x: 100, y: 100, width: 1100, height: 740, maximized: true }, areas),
  ).toEqual({ x: 100, y: 100, width: 1100, height: 740, maximized: true });
  const removed = restoreWindowState({ x: -3000, y: 100, width: 3000, height: 2000 }, areas);
  expect(removed).toEqual({ x: 0, y: 25, width: 1440, height: 875, maximized: false });
  expect(restoreWindowState({ x: NaN }, areas).width).toBe(1280);
});

function setup() {
  const db = new Database(":memory:");
  const a = db.addAccount("A");
  db.createTask(
    "Private article body",
    [],
    [1, 2].map((id) => ({
      accountId: a.id,
      identityId: String(id),
      name: `Target ${id}`,
      kind: "profile" as const,
    })),
  );
  const notices: TaskNotice[] = [];
  const notifier = new TaskNotifications(db, (notice) => notices.push(notice));
  return { db, notices, notifier, targets: db.targets() };
}
it("notifies once for a completed task and never leaks the article body", () => {
  const { db, notices, notifier, targets } = setup();
  db.transition(targets[0].id, "verified", null, "https://www.facebook.com/1/posts/1");
  expect(notices).toHaveLength(0);
  db.transition(targets[1].id, "verified", null, "https://www.facebook.com/2/posts/2");
  expect(notices[0].title).toBe("发布完成");
  expect(notices[0].taskId).toBe(targets[0].taskId);
  expect(JSON.stringify(notices)).not.toContain("Private article body");
  db.transition(targets[1].id, "verified");
  expect(notices).toHaveLength(1);
  notifier.dispose();
  db.close();
});
it("separates manual checkpoints, uncertain results and retry failures from success", () => {
  const { db, notices, notifier, targets } = setup();
  db.transition(targets[0].id, "awaiting_user");
  expect(notices.at(-1)?.title).toBe("需要人工处理");
  db.transition(targets[0].id, "pending");
  db.transition(targets[0].id, "unknown");
  db.transition(targets[1].id, "verified");
  expect(notices.at(-1)?.title).toBe("发布结果待核验");
  db.transition(targets[0].id, "failed");
  expect(notices.at(-1)?.title).toBe("发布任务有失败项");
  const count = notices.length;
  db.retry(targets[0].id);
  db.transition(targets[0].id, "failed");
  expect(notices).toHaveLength(count + 1);
  notifier.dispose();
  db.close();
});
