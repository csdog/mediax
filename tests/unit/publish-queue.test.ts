import { it, expect, vi } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { PublishQueue } from "../../src/main/publish/PublishQueue";
import { NeedsUser, type Publisher } from "../../src/main/platforms/Publisher";
function setup() {
  const db = new Database(":memory:");
  const a = db.addAccount("A");
  db.createTask(
    "body",
    [],
    [
      { accountId: a.id, identityId: "1", name: "profile", kind: "profile" },
      { accountId: a.id, identityId: "2", name: "page", kind: "page" },
    ],
  );
  return db;
}
it("runs targets without repeating verified ones", async () => {
  const db = setup(),
    calls: string[] = [];
  const p: Publisher = {
    supportedKinds: () => [],
    prepare: async () => {},
    submit: async (_, t) => {
      calls.push(t.identityId);
    },
    verify: async (_, t) => `https://www.facebook.com/${t.identityId}/posts/123`,
  };
  const q = new PublishQueue(
    db,
    () => p,
    () => 1,
  );
  await Promise.all([q.run(), q.run()]);
  expect(calls).toEqual(["1", "2"]);
  expect(db.targets().every((t) => t.status === "verified")).toBe(true);
  await q.run();
  expect(calls).toHaveLength(2);
  db.close();
});

it("publishes different accounts in parallel up to the concurrency limit", async () => {
  const db = new Database(":memory:");
  const first = db.addAccount("A");
  const second = db.addAccount("B");
  db.createTask(
    "body",
    [],
    [
      { accountId: first.id, identityId: "1", name: "a", kind: "profile" },
      { accountId: second.id, identityId: "2", name: "b", kind: "profile" },
    ],
  );
  let active = 0;
  let peak = 0;
  const gate = Promise.withResolvers<void>();
  const p: Publisher = {
    supportedKinds: () => [],
    prepare: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await gate.promise;
      active -= 1;
    },
    submit: async () => {},
    verify: async (_, t) => `https://example.com/${t.identityId}`,
  };
  const q = new PublishQueue(
    db,
    () => p,
    () => 2,
  );
  const run = q.run();
  await vi.waitFor(() => expect(peak).toBe(2));
  gate.resolve();
  await run;
  expect(db.targets().every((t) => t.status === "verified")).toBe(true);
  db.close();
});
it("pauses on verification and resumes only after another preparation", async () => {
  const db = setup();
  let blocked = true;
  let submitted = 0;
  const p: Publisher = {
    supportedKinds: () => [],
    prepare: async () => {
      if (blocked) throw new NeedsUser("login");
    },
    submit: async () => {
      submitted++;
    },
    verify: async () => null,
  };
  const q = new PublishQueue(
    db,
    () => p,
    () => 1,
  );
  await q.run();
  expect(db.targets().map((t) => t.status)).toEqual(["awaiting_user", "awaiting_user"]);
  blocked = false;
  await q.resume(db.targets()[0].id);
  expect(db.targets().map((t) => t.status)).toEqual(["verified", "awaiting_user"]);
  await q.resume(db.targets()[1].id);
  expect(submitted).toBe(2);
  expect(db.targets().every((t) => t.status === "verified")).toBe(true);
  db.close();
});
it("keeps ambiguous submit unknown and refuses retry", async () => {
  const db = setup();
  const p: Publisher = {
    supportedKinds: () => [],
    prepare: async () => {},
    submit: async (_task, _target, markSubmitted) => {
      markSubmitted();
      throw new Error("connection lost");
    },
    verify: async () => null,
  };
  const q = new PublishQueue(db, () => p);
  await q.run();
  expect(db.targets()[0].status).toBe("unknown");
  expect(() => db.retry(db.targets()[0].id)).toThrow();
  db.close();
});
it("allows a clear preparation failure to retry without rerunning success", async () => {
  const db = setup();
  let failed = true;
  const submits: string[] = [];
  const p: Publisher = {
    supportedKinds: () => [],
    prepare: async (_, t) => {
      if (t.identityId === "1" && failed) throw new Error("unreadable image");
    },
    submit: async (_, t) => {
      submits.push(t.identityId);
    },
    verify: async (_, t) => `https://www.facebook.com/${t.identityId}/posts/123`,
  };
  const q = new PublishQueue(db, () => p);
  await q.run();
  expect(submits).toEqual(["2"]);
  failed = false;
  db.retry(db.targets()[0].id);
  await q.run();
  expect(submits).toEqual(["2", "1"]);
  db.close();
});

it("records adapter initialization failures without leaving a running target", async () => {
  const db = setup();
  const queue = new PublishQueue(db, () => {
    throw new Error("closed account tab");
  });
  await queue.run();
  expect(db.targets().map((t) => t.status)).toEqual(["failed", "failed"]);
  db.close();
});
