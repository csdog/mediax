import { expect, it, vi } from "vitest";
import type { AccountService } from "../../src/main/accounts/AccountService";
import { PublishService } from "../../src/main/publish/PublishService";
import { Database } from "../../src/main/storage/Database";
import { groupPublishBatches, platformHasCustomContent } from "../../src/shared/publishBatches";
import type { AccountInfo, Target } from "../../src/shared/models";

it("groups targets by resolved batch and per-platform content", () => {
  const douyin: AccountInfo = {
    id: "a1",
    name: "抖音号",
    platform: "douyin",
    login: "logged_in",
    targets: [],
  };
  const xhs: AccountInfo = {
    id: "a2",
    name: "小红书号",
    platform: "xiaohongshu",
    login: "logged_in",
    targets: [],
  };
  const targets: Target[] = [
    { accountId: "a1", identityId: "1", name: "抖音", kind: "profile" },
    { accountId: "a2", identityId: "2", name: "小红书", kind: "profile" },
  ];
  const batches = groupPublishBatches({
    kind: "moment",
    title: "",
    body: "批量正文",
    targets,
    accounts: [douyin, xhs],
    platformContent: {
      xiaohongshu: { title: "", body: "小红书正文" },
    },
  });
  expect(batches).toHaveLength(2);
  expect(batches.find((batch) => batch.body === "批量正文")?.targets).toEqual([targets[0]]);
  expect(batches.find((batch) => batch.body === "小红书正文")?.targets).toEqual([targets[1]]);
  expect(
    platformHasCustomContent(
      "xiaohongshu",
      { title: "", body: "批量正文" },
      {
        xiaohongshu: { title: "", body: "小红书正文" },
      },
    ),
  ).toBe(true);
  expect(platformHasCustomContent("douyin", { title: "", body: "批量正文" }, {})).toBe(false);
});

it("creates multiple tasks in one publishBatches call", async () => {
  const db = new Database(":memory:");
  const first = db.addAccount("抖音", "douyin");
  const second = db.addAccount("小红书", "xiaohongshu");
  const targetA = {
    accountId: first.id,
    identityId: "1",
    name: "抖音主页",
    kind: "profile" as const,
  };
  const targetB = {
    accountId: second.id,
    identityId: "2",
    name: "小红书主页",
    kind: "profile" as const,
  };
  const accounts = {
    list: () => [
      { ...first, login: "logged_in" as const, targets: [targetA] },
      { ...second, login: "logged_in" as const, targets: [targetB] },
    ],
    adapter: vi.fn(),
    exclusive: (work: () => Promise<void>) => work(),
  } as unknown as AccountService;
  const publishing = new PublishService(db, accounts, "/tmp/mediax-batch-assets");
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const focusId = await publishing.publishBatches(
    "moment",
    [],
    [
      { title: null, body: "给抖音", targets: [targetA] },
      { title: null, body: "给小红书", targets: [targetB] },
    ],
    scheduledAt,
  );
  const tasks = db.tasks();
  expect(tasks).toHaveLength(2);
  expect(tasks.map((task) => task.body).sort()).toEqual(["给小红书", "给抖音"]);
  expect(tasks.some((task) => task.id === focusId)).toBe(true);
  expect(db.targets()).toHaveLength(2);
  expect(db.targets().every((target) => target.status === "scheduled")).toBe(true);
  publishing.stopScheduler();
  db.close();
});
