import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Database } from "../../../src/main/storage/Database";
import { PublishService } from "../../../src/main/publish/PublishService";
import type { AccountService } from "../../../src/main/accounts/AccountService";
import type { Publisher } from "../../../src/main/platforms/Publisher";

let db: Database;
let publishing: PublishService;
let online: boolean;
let busy: boolean;
let submit: ReturnType<typeof vi.fn<Publisher["submit"]>>;
beforeEach(() => {
  vi.useFakeTimers();
  db = new Database(":memory:");
  online = true;
  busy = false;
  submit = vi.fn(async (_, _target, markSubmitted) => markSubmitted());
  const publisher: Publisher = {
    supportedKinds: () => ["moment"],
    prepare: async () => {},
    submit,
    verify: async () => "https://example.com/post",
    verifyExisting: async () => null,
  };
  const accounts = {
    adapter: () => publisher,
    exclusive: async (work: () => Promise<void>) => {
      if (busy) throw new Error("正在检查账号");
      return work();
    },
  } as unknown as AccountService;
  publishing = new PublishService(db, accounts, "/tmp/mediax-availability-assets", () => online);
});
afterEach(() => {
  publishing.stopScheduler();
  db.close();
  vi.useRealTimers();
});

function create(scheduledAt?: string) {
  const account = db.addAccount("账号", "weibo");
  return db.createTask(
    "正文",
    [],
    [{ accountId: account.id, identityId: "1", name: "主页", kind: "profile" }],
    { contentKind: "moment", scheduledAt },
  );
}

it("keeps due tasks pending offline and automatically processes them when connectivity returns", async () => {
  online = false;
  create(new Date(Date.now() + 30_000).toISOString());
  publishing.startScheduler();
  await vi.advanceTimersByTimeAsync(35_000);
  expect(db.targets()[0]!.status).toBe("pending");
  expect(submit).not.toHaveBeenCalled();
  online = true;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(db.targets()[0]!.status).toBe("verified");
  expect(submit).toHaveBeenCalledTimes(1);
});

it("immediately catches up overdue schedules after waking, without waiting for the old timer", async () => {
  create(new Date(Date.now() + 60_000).toISOString());
  publishing.startScheduler();
  publishing.suspend();
  vi.setSystemTime(Date.now() + 120_000);
  expect(db.targets()[0]!.status).toBe("scheduled");
  publishing.wake();
  await vi.advanceTimersByTimeAsync(0);
  expect(db.targets()[0]!.status).toBe("verified");
  expect(submit).toHaveBeenCalledTimes(1);
});

it("waits for connectivity if the computer wakes while still offline", async () => {
  create();
  publishing.suspend();
  publishing.startScheduler();
  online = false;
  publishing.wake();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(db.targets()[0]!.status).toBe("pending");
  online = true;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(submit).toHaveBeenCalledTimes(1);
});

it("retries claiming pending work after an account inspection releases the browser", async () => {
  create();
  busy = true;
  publishing.startScheduler();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(db.targets()[0]!.status).toBe("pending");
  busy = false;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(db.targets()[0]!.status).toBe("verified");
});

it.each(["offline", "sleep"] as const)(
  "does not revive an interrupted preparation after %s recovers",
  async (event) => {
    const entered = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    const task = create();
    const accounts = {
      adapter: () => ({
        prepare: async () => {
          entered.resolve();
          await gate.promise;
        },
        submit,
        verify: async () => "https://example.com/post",
      }),
      exclusive: (work: () => Promise<void>) => work(),
    } as unknown as AccountService;
    publishing = new PublishService(db, accounts, "/tmp/mediax-availability-assets", () => online);
    publishing.startScheduler();
    await entered.promise;
    if (event === "sleep") publishing.suspend();
    else {
      online = false;
      await vi.advanceTimersByTimeAsync(5_000);
    }
    if (event === "sleep") publishing.wake();
    else {
      online = true;
      await vi.advanceTimersByTimeAsync(5_000);
    }
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(db.targets(task.id)[0]!.status).toBe("awaiting_user");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(submit).not.toHaveBeenCalled();
  },
);

it("does not automatically retry failed, awaiting-user, submitted or unknown targets", async () => {
  for (const status of ["failed", "awaiting_user", "submitted", "unknown", "verified"] as const) {
    const task = create();
    db.transition(db.targets(task.id)[0]!.id, status);
  }
  publishing.startScheduler();
  publishing.suspend();
  publishing.wake();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(submit).not.toHaveBeenCalled();
});

it("stops availability polling when the service stops and does not multiply timers on repeated start", async () => {
  online = false;
  create();
  publishing.startScheduler();
  const timers = vi.getTimerCount();
  publishing.startScheduler();
  expect(vi.getTimerCount()).toBe(timers);
  publishing.stopScheduler();
  expect(vi.getTimerCount()).toBe(0);
  online = true;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(submit).not.toHaveBeenCalled();
});
