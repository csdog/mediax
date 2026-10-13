// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../../src/renderer/src";

vi.mock("../../src/renderer/lib/logging", () => ({ initializeRendererLogging: vi.fn() }));

it("lists publish records with filters from the reference layout", async () => {
  window.desktop = {
    onCommand: vi.fn(() => () => undefined),
    shortcutSettings: vi.fn().mockResolvedValue({
      accelerator: "CommandOrControl+M",
      registered: true,
      shortcuts: { "global-show": "CommandOrControl+M" },
    }),
    setShortcut: vi.fn(),
    resetShortcuts: vi.fn(),
    publishSettings: vi
      .fn()
      .mockResolvedValue({ silent: false, concurrency: 3, bandwidthLimitKbps: 0 }),
    setSilentPublish: vi
      .fn()
      .mockResolvedValue({ silent: false, concurrency: 3, bandwidthLimitKbps: 0 }),
    setPublishSettings: vi.fn().mockImplementation(async (patch) => ({
      silent: false,
      concurrency: 3,
      bandwidthLimitKbps: 0,
      ...patch,
    })),
    updateStatus: vi.fn().mockResolvedValue({
      state: "idle",
      currentVersion: "0.1.0",
      availableVersion: null,
      progress: null,
      message: null,
      canCheck: true,
      canInstall: false,
    }),
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    onUpdateStatus: vi.fn(() => () => undefined),
    profileSettings: vi.fn().mockResolvedValue({ name: "MediaX", avatar: null }),
    setProfile: vi.fn().mockImplementation(async (profile) => profile),
    chooseAvatar: vi.fn().mockResolvedValue(null),
    notificationSettings: vi.fn().mockResolvedValue({
      enabled: true,
      publishResult: true,
      awaitingUser: true,
      privacy: false,
      sound: true,
    }),
    setNotificationSettings: vi.fn().mockImplementation(async (patch) => ({
      enabled: true,
      publishResult: true,
      awaitingUser: true,
      privacy: false,
      sound: true,
      ...patch,
    })),
    notificationPermission: vi.fn().mockResolvedValue({
      supported: true,
      label: "由系统控制",
      detail: "测试环境",
    }),
    openNotificationSettings: vi.fn(),
    testNotification: vi.fn().mockResolvedValue({ ok: true, message: "已发送测试通知" }),
    themePreference: vi.fn().mockResolvedValue("system"),
    setThemePreference: vi.fn().mockImplementation(async (preference) => preference),
    autoUpdateEnabled: vi.fn().mockResolvedValue(true),
    setAutoUpdateEnabled: vi.fn().mockImplementation(async (enabled: boolean) => enabled),
    desktopBehavior: vi.fn().mockResolvedValue({ keepAwakeWhilePublishing: true }),
    setDesktopBehavior: vi.fn().mockImplementation(async (patch) => ({
      keepAwakeWhilePublishing: true,
      ...patch,
    })),
    importLocalFiles: vi.fn().mockResolvedValue({ markdown: null, assets: [], warnings: [] }),
    revealInFolder: vi.fn(),
    pathForFile: vi.fn(),
    diagnostics: vi.fn().mockResolvedValue({
      generatedAt: "2026-10-13T00:00:00.000Z",
      app: { name: "MediaX", version: "0.1.0", packaged: false },
      runtime: {
        electron: "44",
        chrome: "1",
        node: "26",
        platform: "darwin",
        arch: "arm64",
      },
      paths: { userData: "/tmp", logsDir: "/tmp/logs", logFile: "/tmp/logs/main.log" },
      counts: { accounts: 0, tasks: 0, targets: {} },
      storage: {
        totalBytes: 1024,
        categories: [
          { id: "database", label: "数据库", bytes: 512 },
          { id: "sessions", label: "浏览器会话", bytes: 256 },
          { id: "assets", label: "发布素材", bytes: 128 },
          { id: "logs", label: "日志", bytes: 64 },
          { id: "cache", label: "缓存", bytes: 32 },
          { id: "other", label: "其他", bytes: 32 },
        ],
      },
      logTail: "log line",
    }),
    storageUsage: vi.fn().mockResolvedValue({
      totalBytes: 1024,
      categories: [
        { id: "database", label: "数据库", bytes: 512 },
        { id: "sessions", label: "浏览器会话", bytes: 256 },
        { id: "assets", label: "发布素材", bytes: 128 },
        { id: "logs", label: "日志", bytes: 64 },
        { id: "cache", label: "缓存", bytes: 32 },
        { id: "other", label: "其他", bytes: 32 },
      ],
    }),
    clearStorage: vi.fn().mockResolvedValue({ freedBytes: 32 }),
    exportDiagnostics: vi.fn().mockResolvedValue(null),
    revealLogFile: vi.fn(),
    openAtLogin: vi.fn().mockResolvedValue({ openAtLogin: false, detail: null }),
    setOpenAtLogin: vi.fn().mockImplementation(async (openAtLogin: boolean) => ({
      openAtLogin,
      detail: null,
    })),
    accounts: vi
      .fn()
      .mockResolvedValue([{ id: "account-1", name: "用户K7Wa", login: "logged_in", targets: [] }]),
    history: vi.fn().mockResolvedValue({
      tasks: [
        {
          id: "task-1",
          contentKind: "moment",
          title: null,
          body: "吐槽网上线 Skill：让发布更稳",
          images: ["/tmp/cover.png"],
          cover: "data:image/png;base64,aaaa",
          createdAt: "2026-10-13T07:27:00.000Z",
        },
      ],
      targets: [
        {
          id: "target-1",
          taskId: "task-1",
          accountId: "account-1",
          identityId: "1001",
          name: "个人主页",
          kind: "profile",
          status: "verified",
          error: null,
          url: "https://www.facebook.com/demo/posts/1",
        },
      ],
    }),
    loadDraft: vi.fn().mockResolvedValue({ body: "", images: [] }),
  } as any;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  render(<App />);
  await waitFor(() => expect(window.desktop.loadDraft).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "打开发布记录" }));
  const tabs = await screen.findByRole("tablist", { name: "发布记录分区" });
  expect(within(tabs).getByRole("tab", { name: "发布记录", selected: true })).toBeTruthy();
  expect(within(tabs).getByRole("tab", { name: "草稿箱" })).toBeTruthy();
  expect(within(tabs).getByRole("tab", { name: "待审核" })).toBeTruthy();
  expect(await screen.findByText("吐槽网上线 Skill：让发布更稳")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "吐槽网上线 Skill：让发布更稳 封面" }).getAttribute("src"),
  ).toBe("data:image/png;base64,aaaa");
  expect(screen.getByRole("cell", { name: "用户K7Wa" })).toBeTruthy();
  expect(screen.getByText("成功")).toBeTruthy();
  expect(screen.getByText("1 账号 · 1 任务")).toBeTruthy();
  expect(screen.getByRole("button", { name: "新增发布" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "操作 吐槽网上线 Skill：让发布更稳" }));
  const openPost = await screen.findByRole("menuitem", { name: "查看" });
  expect(openPost.querySelector("svg")).toBeTruthy();
  const openAccount = screen.getByRole("menuitem", { name: "打开" });
  expect(openAccount.querySelector("svg")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("搜索作品描述或任务标题"), {
    target: { value: "不存在的标题" },
  });
  expect(screen.getByText("没有匹配的发布记录")).toBeTruthy();
});
