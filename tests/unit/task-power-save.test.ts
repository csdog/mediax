import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "../../src/main/storage/Database";

const start = vi.fn(() => 7);
const stop = vi.fn();

vi.mock("electron", () => ({
  powerSaveBlocker: {
    start: (...args: unknown[]) => start(...args),
    stop: (...args: unknown[]) => stop(...args),
  },
}));

describe("TaskPowerSave", () => {
  afterEach(() => {
    start.mockClear();
    stop.mockClear();
  });

  it("starts and stops the idle-sleep blocker with active publish targets", async () => {
    const { TaskPowerSave } = await import("../../src/main/desktop/TaskPowerSave");
    const db = new Database(":memory:");
    const account = db.addAccount("Keeper");
    db.createTask(
      "body",
      [],
      [{ accountId: account.id, identityId: "1", name: "T", kind: "profile" }],
    );
    const target = db.targets()[0]!;
    let enabled = true;
    const saver = new TaskPowerSave(db, () => enabled);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("prevent-app-suspension");

    start.mockClear();
    db.transition(target.id, "running");
    expect(start).not.toHaveBeenCalled();

    db.transition(target.id, "verified");
    expect(stop).toHaveBeenCalled();

    enabled = false;
    start.mockClear();
    db.transition(target.id, "pending");
    db.transition(target.id, "running");
    expect(start).not.toHaveBeenCalled();

    saver.dispose();
    db.close();
  });
});
