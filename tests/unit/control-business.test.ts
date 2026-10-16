import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlApp } from "../../src/main/control/createApp";
import { Database } from "../../src/main/storage/Database";
import { PublishService } from "../../src/main/publish/PublishService";
import type { AccountService } from "../../src/main/accounts/AccountService";

const auth = { Authorization: "Bearer test", "Content-Type": "application/json" };
describe("control business APIs use the desktop publishing service", () => {
  let db: Database;
  let publishing: PublishService;
  let directory: string;
  let app: ReturnType<typeof createControlApp>;
  let input: Record<string, unknown>;
  let adapter: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "mediax-control-"));
    db = new Database(":memory:");
    const account = db.addAccount("测试账号", "toutiao");
    const target = {
      accountId: account.id,
      identityId: "1",
      name: "已验证身份",
      kind: "profile" as const,
    };
    const info = { ...account, login: "logged_in" as const, targets: [target] };
    adapter = vi.fn(() => ({
      prepare: vi.fn(async () => {}),
      submit: vi.fn(async (_task, _target, markSubmitted) => markSubmitted()),
      verify: vi.fn(async () => "https://example.com/post"),
    }));
    const accounts = {
      list: () => [info],
      refresh: vi.fn(async () => info),
      adapter,
      exclusive: (work: () => Promise<void>) => work(),
    } as unknown as AccountService;
    publishing = new PublishService(db, accounts, directory);
    // Keep scheduled work from starting timers; promotion is tested by ScheduleService tests.
    publishing.stopScheduler();
    app = createControlApp({
      token: "test",
      version: "test",
      services: { db, accounts, publishing },
    });
    input = {
      kind: "moment",
      body: "测试内容",
      targets: [{ accountId: account.id, identityId: "1", kind: "profile" }],
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    };
  });
  afterEach(async () => {
    publishing.stopScheduler();
    db.close();
    await rm(directory, { recursive: true, force: true });
  });
  const post = (app: ReturnType<typeof createControlApp>, body: unknown) =>
    app.request("/tasks", { method: "POST", headers: auth, body: JSON.stringify(body) });
  it("protects every business endpoint before validation", async () => {
    for (const [method, path] of [
      ["GET", "/accounts"],
      ["POST", "/accounts/id/refresh"],
      ["GET", "/tasks"],
      ["GET", "/tasks/id"],
      ["POST", "/tasks"],
      ["PATCH", "/tasks/id/schedule"],
      ["GET", "/calendar"],
      ["POST", "/targets/id/retry"],
    ]) {
      expect((await app.request(path, { method })).status).toBe(401);
    }
    expect(db.tasks()).toHaveLength(0);
  });
  it("resolves identities, snapshots assets, lists and reschedules without publishing early", async () => {
    const path = join(directory, "cover.png");
    await writeFile(path, "test image");
    const response = await post(app, { ...input, paths: [path] });
    expect(response.status).toBe(201);
    const detail = await response.json();
    expect(detail.targets[0]).toMatchObject({ status: "scheduled", name: "已验证身份" });
    expect(detail.task.images[0]).not.toBe(path);
    expect(adapter).not.toHaveBeenCalled();
    const at = new Date(Date.now() + 7200_000).toISOString();
    const moved = await app.request(`/tasks/${detail.task.id}/schedule`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ scheduledAt: at }),
    });
    expect(moved.status).toBe(200);
    expect((await moved.json()).task.scheduledAt).toBe(at);
    expect(
      (await (await app.request(`/tasks/${detail.task.id}`, { headers: auth })).json()).task.id,
    ).toBe(detail.task.id);
    const calendar = await app.request(
      `/calendar?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 86400_000).toISOString())}`,
      { headers: auth },
    );
    expect(await calendar.json()).toHaveLength(1);
    expect((await (await app.request("/tasks", { headers: auth })).json()).tasks).toHaveLength(1);
    const accounts = await (await app.request("/accounts", { headers: auth })).json();
    expect(accounts[0].supportedKinds).toContain("moment");
  });
  it("queues immediate work and uses target actions without resubmitting verified work", async () => {
    const response = await post(app, { ...input, scheduledAt: null });
    expect(response.status).toBe(201);
    const detail = await response.json();
    await vi.waitFor(() => expect(db.targets(detail.task.id)[0].status).toBe("verified"));
    expect(adapter).toHaveBeenCalledTimes(1);
    const retry = await app.request(`/targets/${detail.targets[0].id}/retry`, {
      method: "POST",
      headers: auth,
    });
    expect(retry.status).toBe(409);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed JSON, unsupported targets, invalid dates and local paths with no side effects", async () => {
    for (const bad of [
      { ...input, targets: [] },
      { ...input, paths: ["relative.png"] },
      { ...input, scheduledAt: "tomorrow" },
      { ...input, scheduledAt: "2020-01-01T00:00:00Z" },
      { ...input, targets: [{ accountId: "unknown", identityId: "1", kind: "profile" }] },
      { ...input, kind: "audio", paths: [] },
    ]) {
      expect((await post(app, bad)).status).toBeGreaterThanOrEqual(400);
      expect(db.tasks()).toHaveLength(0);
    }
    expect((await app.request("/tasks", { method: "POST", headers: auth, body: "{" })).status).toBe(
      400,
    );
    expect(adapter).not.toHaveBeenCalled();
  });
  it("does not reschedule immediate or submitted work, and rejects missing targets", async () => {
    const response = await post(app, input);
    const detail = await response.json();
    db.transition(detail.targets[0].id, "pending");
    const moved = await app.request(`/tasks/${detail.task.id}/schedule`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ scheduledAt: input.scheduledAt }),
    });
    expect(moved.status).toBe(409);
    expect(
      (await app.request("/targets/missing/retry", { method: "POST", headers: auth })).status,
    ).toBe(404);
    expect((await app.request("/tasks/missing", { headers: auth })).status).toBe(404);
  });
});
