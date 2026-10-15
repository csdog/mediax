import { describe, expect, it, vi } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { ScheduleService } from "../../src/main/publish/ScheduleService";

describe("schedule + analytics", () => {
  it("creates scheduled tasks and promotes them when due", () => {
    const db = new Database(":memory:");
    const account = db.addAccount("Sched", "facebook");
    const when = new Date(Date.now() + 60_000).toISOString();
    const task = db.createTask(
      "hello",
      [],
      [{ accountId: account.id, identityId: "1", name: "Me", kind: "profile" }],
      { contentKind: "moment", scheduledAt: when },
    );
    expect(task.scheduledAt).toBe(when);
    expect(db.targets(task.id).every((t) => t.status === "scheduled")).toBe(true);
    expect(db.promoteDueScheduled(new Date(Date.now() + 1_000))).toEqual([]);
    const promoted = db.promoteDueScheduled(new Date(Date.now() + 120_000));
    expect(promoted).toEqual([task.id]);
    expect(db.targets(task.id).every((t) => t.status === "pending")).toBe(true);
    db.close();
  });

  it("reschedules only scheduled tasks", () => {
    const db = new Database(":memory:");
    const account = db.addAccount("Sched", "zhihu");
    const when = new Date(Date.now() + 120_000).toISOString();
    const task = db.createTask(
      "body",
      [],
      [{ accountId: account.id, identityId: "1", name: "Me", kind: "profile" }],
      { scheduledAt: when },
    );
    const later = new Date(Date.now() + 300_000).toISOString();
    expect(db.rescheduleTask(task.id, later).scheduledAt).toBe(later);
    db.transition(db.targets(task.id)[0]!.id, "pending");
    expect(() => db.rescheduleTask(task.id, new Date(Date.now() + 400_000).toISOString())).toThrow(
      /仅等待排期/,
    );
    db.close();
  });

  it("aggregates local analytics", () => {
    const db = new Database(":memory:");
    const account = db.addAccount("A", "weibo");
    const task = db.createTask(
      "post",
      [],
      [{ accountId: account.id, identityId: "1", name: "Me", kind: "profile" }],
      { contentKind: "moment" },
    );
    db.transition(db.targets(task.id)[0]!.id, "verified", null, "https://example.com/1");
    const summary = db.analyticsSummary(7);
    expect(summary.totals.tasks).toBe(1);
    expect(summary.totals.verified).toBe(1);
    expect(summary.successRate).toBe(1);
    expect(summary.byPlatform[0]?.platform).toBe("weibo");
    db.close();
  });

  it("ScheduleService promotes and notifies", async () => {
    vi.useFakeTimers();
    const db = new Database(":memory:");
    const account = db.addAccount("S", "douyin");
    const when = new Date(Date.now() + 30_000).toISOString();
    db.createTask(
      "x",
      [],
      [{ accountId: account.id, identityId: "1", name: "Me", kind: "profile" }],
      { scheduledAt: when },
    );
    const promoted: string[][] = [];
    const service = new ScheduleService(db, (ids) => promoted.push(ids));
    service.start();
    expect(promoted).toEqual([]);
    await vi.advanceTimersByTimeAsync(35_000);
    expect(promoted.length).toBeGreaterThanOrEqual(1);
    expect(db.targets().every((t) => t.status === "pending")).toBe(true);
    service.stop();
    db.close();
    vi.useRealTimers();
  });
});
