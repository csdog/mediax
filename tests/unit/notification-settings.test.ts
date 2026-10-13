import { expect, it } from "vitest";
import { Database } from "../../src/main/storage/Database";
import { TaskNotifications, type TaskNotice } from "../../src/main/desktop/TaskNotifications";
import {
  mergeNotificationSettings,
  readNotificationSettings,
} from "../../src/shared/notificationSettings";
import { formatDiagnosticReport, type DiagnosticReport } from "../../src/main/desktop/diagnostics";

it("reads and merges notification preferences", () => {
  const store = new Map<string, unknown>([["notificationPrivacy", true]]);
  expect(readNotificationSettings((key) => store.get(key) ?? null)).toEqual({
    enabled: true,
    publishResult: true,
    awaitingUser: true,
    privacy: true,
    sound: true,
  });
  expect(
    mergeNotificationSettings(
      readNotificationSettings(() => null),
      {
        enabled: false,
        publishResult: false,
        sound: false,
      },
    ),
  ).toEqual({
    enabled: false,
    publishResult: false,
    awaitingUser: true,
    privacy: false,
    sound: false,
  });
});

it("respects notification switches and privacy when composing notices", () => {
  const db = new Database(":memory:");
  const account = db.addAccount("Secret Account");
  db.createTask(
    "Private body",
    [],
    [
      {
        accountId: account.id,
        identityId: "1",
        name: "Secret Target",
        kind: "profile",
      },
    ],
  );
  const target = db.targets()[0];
  const notices: TaskNotice[] = [];
  const prefs = {
    enabled: true,
    publishResult: true,
    awaitingUser: true,
    privacy: true,
    sound: true,
  };
  const notifier = new TaskNotifications(
    db,
    (notice) => notices.push(notice),
    () => prefs,
  );
  db.transition(target.id, "awaiting_user");
  expect(notices.at(-1)?.body).toContain("有目标需要登录或验证");
  expect(JSON.stringify(notices)).not.toContain("Secret Target");
  prefs.enabled = false;
  notices.length = 0;
  db.transition(target.id, "pending");
  db.transition(target.id, "awaiting_user");
  expect(notices).toHaveLength(0);
  notifier.dispose();
  db.close();
});

it("formats diagnostics without embedding draft bodies", () => {
  const report: DiagnosticReport = {
    generatedAt: "2026-10-13T00:00:00.000Z",
    app: { name: "MediaX", version: "0.1.0", packaged: false },
    runtime: {
      electron: "44.0.0",
      chrome: "1",
      node: "26",
      platform: "darwin",
      arch: "arm64",
    },
    paths: {
      userData: "/tmp/user",
      logsDir: "/tmp/user/logs",
      logFile: "/tmp/user/logs/main.log",
    },
    counts: { accounts: 1, tasks: 2, targets: { verified: 1 } },
    storage: {
      totalBytes: 700,
      categories: [
        { id: "database", label: "数据库", bytes: 100 },
        { id: "sessions", label: "浏览器会话", bytes: 200 },
        { id: "assets", label: "发布素材", bytes: 50 },
        { id: "logs", label: "日志", bytes: 25 },
        { id: "cache", label: "缓存", bytes: 300 },
        { id: "other", label: "其他", bytes: 25 },
      ],
    },
    logTail: "Application starting",
  };
  const text = formatDiagnosticReport(report);
  expect(text).toContain("MediaX diagnostic report");
  expect(text).toContain("accounts: 1");
  expect(text).toContain("Application starting");
});
