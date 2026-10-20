// @vitest-environment jsdom
import "./setup";
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { App } from "../../src/renderer/src";
// jsdom has no native preload; exercise real logging in Electron integration instead.
vi.mock("../../src/renderer/lib/logging", () => ({ initializeRendererLogging: vi.fn() }));
it("imports and saves content, manages desktop tabs/settings, and requires target selection plus publish confirmation", async () => {
  let commandListener: ((command: any) => void) | undefined;
  let profile = { name: "MediaX", avatar: null as string | null };
  let firstAccountCreated = false;
  const navigationListeners = new Set<
    Parameters<typeof window.desktop.onBrowserNavigationChanged>[0]
  >();
  window.desktop = {
    accountGroups: vi.fn().mockResolvedValue([]),
    createAccountGroup: vi.fn(),
    onCommand: vi.fn((listener) => {
      commandListener = listener;
      return () => {
        commandListener = undefined;
      };
    }),
    shortcutSettings: vi.fn().mockResolvedValue({
      accelerator: "CommandOrControl+Shift+Space",
      registered: true,
      shortcuts: {
        "global-show": "CommandOrControl+Shift+Space",
        "new-tab": "CommandOrControl+T",
        "close-tab": "CommandOrControl+W",
        "reopen-tab": "CommandOrControl+Shift+T",
        "next-tab": "Control+Tab",
        "previous-tab": "Control+Shift+Tab",
        settings: "CommandOrControl+,",
        compose: "CommandOrControl+N",
        "save-draft": "CommandOrControl+S",
        "import-markdown": "CommandOrControl+O",
        accounts: "CommandOrControl+1",
        "compose-page": "CommandOrControl+2",
        video: "CommandOrControl+3",
        history: "CommandOrControl+4",
        "hide-window": "CommandOrControl+Shift+W",
      },
    }),
    setGlobalShortcut: vi.fn().mockImplementation(async (accelerator) => {
      const shortcuts = {
        ...(await window.desktop.shortcutSettings()).shortcuts,
        "global-show": accelerator,
      };
      return { accelerator, registered: Boolean(accelerator), shortcuts };
    }),
    setShortcut: vi.fn().mockImplementation(async (id, accelerator) => {
      const current = await window.desktop.shortcutSettings();
      const shortcuts = { ...current.shortcuts, [id]: accelerator };
      return {
        accelerator: shortcuts["global-show"] ?? "",
        registered: Boolean(shortcuts["global-show"]),
        shortcuts,
      };
    }),
    resetShortcuts: vi.fn().mockImplementation(async () => {
      const shortcuts = {
        "global-show": "CommandOrControl+M",
        "new-tab": "CommandOrControl+T",
        "close-tab": "CommandOrControl+W",
        "reopen-tab": "CommandOrControl+Shift+T",
        "next-tab": "Control+Tab",
        "previous-tab": "Control+Shift+Tab",
        settings: "CommandOrControl+,",
        compose: "CommandOrControl+N",
        "save-draft": "CommandOrControl+S",
        "import-markdown": "CommandOrControl+O",
        accounts: "CommandOrControl+1",
        "compose-page": "CommandOrControl+2",
        video: "CommandOrControl+3",
        history: "CommandOrControl+4",
        "hide-window": "CommandOrControl+Shift+W",
      };
      return { accelerator: shortcuts["global-show"], registered: true, shortcuts };
    }),
    publishSettings: vi
      .fn()
      .mockResolvedValue({ silent: false, concurrency: 3, bandwidthLimitKbps: 0 }),
    setSilentPublish: vi.fn().mockImplementation(async (silent: boolean) => ({
      silent,
      concurrency: 3,
      bandwidthLimitKbps: 0,
    })),
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
    browserNavigation: vi.fn(async () => ({
      url: "https://facebook.com/",
      title: "Facebook 网站",
      icon: "data:image/png;base64,aWNvbg==",
      canGoBack: false,
      canGoForward: false,
    })),
    onBrowserNavigationChanged: (listener) => {
      navigationListeners.add(listener);
      return () => {
        navigationListeners.delete(listener);
      };
    },
    onDownloadsChanged: vi.fn(() => () => undefined),
    onNativePopupHostEvent: vi.fn(() => () => undefined),
    showNativePopup: vi.fn().mockResolvedValue(undefined),
    hideNativePopup: vi.fn().mockResolvedValue(undefined),
    profileSettings: vi.fn(async () => profile),
    setProfile: vi.fn(async (next: { name: string; avatar: string | null }) => {
      profile = next;
      return profile;
    }),
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
    desktopBehavior: vi.fn().mockResolvedValue({
      keepAwakeWhilePublishing: true,
      calendarTimezone: "system",
    }),
    setDesktopBehavior: vi.fn().mockImplementation(async (patch) => ({
      keepAwakeWhilePublishing: true,
      calendarTimezone: "system",
      ...patch,
    })),
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
    accounts: vi.fn().mockResolvedValue([]),
    addAccount: vi.fn().mockImplementation(async () => {
      const account = {
        id: "account-1",
        name: "Facebook 账号 1",
        platform: "facebook",
        login: "logged_in",
        targets: [],
      };
      if (!firstAccountCreated) {
        firstAccountCreated = true;
        vi.mocked(window.desktop.accounts).mockResolvedValue([account] as Awaited<
          ReturnType<typeof window.desktop.accounts>
        >);
      }
      return account;
    }),
    layoutAccountBrowser: vi.fn().mockResolvedValue(undefined),
    closeAccountBrowser: vi.fn().mockResolvedValue(undefined),
    openAccount: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue({ tasks: [], targets: [] }),
    loadDraft: vi.fn().mockResolvedValue({ body: "", images: [] }),
    importMarkdown: vi.fn().mockResolvedValue("Imported article"),
    importLocalFiles: vi.fn().mockResolvedValue({ markdown: null, assets: [], warnings: [] }),
    revealInFolder: vi.fn(),
    pathForFile: vi.fn((file: File) => (file as File & { path?: string }).path ?? ""),
    saveDraft: vi.fn().mockResolvedValue(undefined),
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
  vi.stubGlobal("scrollTo", vi.fn());
  const choosePublishKind = async (name: string) => {
    const navigation = screen.getByRole("navigation", { name: "工作区导航" });
    fireEvent.click(within(navigation).getByRole("button", { name: "发布", exact: true }));
    const dialog = await screen.findByRole("dialog", { name: "选择发布类型" });
    fireEvent.click(within(dialog).getByRole("button", { name, exact: true }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "选择发布类型" })).toBeNull());
  };
  render(<App />);
  await waitFor(() => expect(window.desktop.loadDraft).toHaveBeenCalled());
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "添加账号" }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "新建标签页" }));
  expect(screen.getByRole("heading", { name: "新标签页", exact: true })).toBeTruthy();
  expect(
    screen.getByRole("tab", { name: "新标签页", exact: true }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.queryByRole("dialog", { name: "新建标签页" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "新建标签页" }));
  fireEvent.click(screen.getByRole("button", { name: "扩展" }));
  await waitFor(() =>
    expect(window.desktop.showNativePopup).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "extensions" }),
    ),
  );
  vi.mocked(window.desktop.hideNativePopup).mockClear();
  await act(async () => commandListener?.({ action: "tab", operation: "close" }));
  await waitFor(() => expect(window.desktop.hideNativePopup).toHaveBeenCalled());
  expect(screen.getAllByRole("tab", { name: "新标签页", exact: true })).toHaveLength(1);
  await act(async () => commandListener?.({ action: "tab", operation: "close" }));
  await waitFor(() =>
    expect(screen.queryByRole("tab", { name: "新标签页", exact: true })).toBeNull(),
  );
  act(() => commandListener?.({ action: "tab", operation: "reopen" }));
  expect(
    screen.getByRole("tab", { name: "新标签页", exact: true }).getAttribute("aria-selected"),
  ).toBe("true");
  act(() => commandListener?.({ action: "tab", operation: "previous" }));
  expect(
    screen.getByRole("tab", { name: "账号管理", exact: true }).getAttribute("aria-selected"),
  ).toBe("true");
  act(() => commandListener?.({ action: "tab", operation: "next" }));
  expect(
    screen.getByRole("tab", { name: "新标签页", exact: true }).getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(
    within(screen.getByRole("region", { name: "工具" })).getByRole("button", { name: /发布记录/ }),
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "发布记录", exact: true })).toBeTruthy(),
  );
  const workspaceTabs = screen.getByRole("tablist", { name: "工作区标签页" });
  expect(
    within(workspaceTabs)
      .getByRole("tab", { name: "发布记录", exact: true })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    within(workspaceTabs)
      .getByRole("tab", { name: "账号管理", exact: true })
      .getAttribute("aria-selected"),
  ).toBe("false");
  fireEvent.click(within(workspaceTabs).getByRole("tab", { name: "账号管理", exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "账号管理", exact: true })).toBeTruthy(),
  );
  expect(within(workspaceTabs).getByRole("tab", { name: "发布记录", exact: true })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "新建标签页" }));
  fireEvent.click(
    within(screen.getByRole("region", { name: "工具" })).getByRole("button", { name: /账号管理/ }),
  );
  await waitFor(() =>
    expect(
      within(workspaceTabs)
        .getAllByRole("tab", { name: "账号管理", exact: true })
        .some((tab) => tab.getAttribute("aria-selected") === "true"),
    ).toBe(true),
  );
  expect(within(workspaceTabs).getAllByRole("tab", { name: "账号管理", exact: true })).toHaveLength(
    2,
  );
  fireEvent.click(screen.getByRole("button", { name: "关闭 账号管理 标签页" }));
  await waitFor(() =>
    expect(
      within(workspaceTabs).getAllByRole("tab", { name: "账号管理", exact: true }),
    ).toHaveLength(1),
  );
  fireEvent.click(screen.getByRole("tab", { name: "账号管理", exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "账号管理", exact: true })).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole("button", { name: "添加账号", exact: true }));
  const addAccountDialog = screen.getByRole("dialog", { name: "添加账号" });
  expect(addAccountDialog).toBeTruthy();
  expect(within(addAccountDialog).getByRole("tab", { name: "全部" })).toBeTruthy();
  expect(
    within(addAccountDialog).getByRole("button", { name: "抖音" }).querySelector("img"),
  ).toBeTruthy();
  expect(within(addAccountDialog).getByRole("button", { name: "小红书" })).toBeTruthy();
  expect(within(addAccountDialog).getByRole("button", { name: "YouTube" })).toBeTruthy();
  expect(within(addAccountDialog).getByRole("button", { name: "TikTok" })).toBeTruthy();
  expect(within(addAccountDialog).getByRole("button", { name: "其他账号" })).toBeTruthy();
  fireEvent.click(within(addAccountDialog).getByRole("tab", { name: "新闻" }));
  expect(within(addAccountDialog).getByRole("button", { name: "简书" })).toBeTruthy();
  expect(within(addAccountDialog).queryByRole("button", { name: "喜马拉雅" })).toBeNull();
  fireEvent.change(within(addAccountDialog).getByLabelText("搜索平台"), {
    target: { value: "头条" },
  });
  expect(within(addAccountDialog).getByRole("button", { name: "头条号" })).toBeTruthy();
  expect(within(addAccountDialog).queryByRole("button", { name: "简书" })).toBeNull();
  fireEvent.click(within(addAccountDialog).getByRole("tab", { name: "全部" }));
  fireEvent.change(within(addAccountDialog).getByLabelText("搜索平台"), {
    target: { value: "" },
  });
  expect(within(addAccountDialog).queryByRole("button", { name: "开始授权" })).toBeNull();
  fireEvent.click(within(addAccountDialog).getByRole("button", { name: "Facebook" }));
  await waitFor(() => expect(window.desktop.openAccount).toHaveBeenCalledWith("account-1"));
  expect(window.desktop.addAccount).toHaveBeenCalledWith("Facebook 账号 1", "facebook");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加账号" })).toBeNull());
  expect(screen.getByRole("tab", { name: "Facebook 网站" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  const pageTab = screen.getByRole("tab", { name: "Facebook 网站" });
  expect(within(pageTab).getByAltText("网站图标").getAttribute("src")).toBe(
    "data:image/png;base64,aWNvbg==",
  );
  expect(within(pageTab).getByLabelText("账号：Facebook 账号 1")).toBeTruthy();
  act(() => {
    for (const listener of navigationListeners)
      listener("account-1", {
        url: "https://facebook.com/next",
        title: "新的页面标题",
        icon: "data:image/png;base64,bmV3",
        canGoBack: true,
        canGoForward: false,
      });
  });
  expect(screen.getByRole("tab", { name: "新的页面标题" })).toBeTruthy();
  expect(
    within(screen.getByRole("tab", { name: "新的页面标题" }))
      .getByAltText("网站图标")
      .getAttribute("src"),
  ).toBe("data:image/png;base64,bmV3");
  act(() => {
    for (const listener of navigationListeners)
      listener("account-1", {
        url: "https://facebook.com/",
        title: "Facebook 网站",
        icon: "data:image/png;base64,aWNvbg==",
        canGoBack: true,
        canGoForward: false,
      });
  });
  fireEvent.click(screen.getByRole("tab", { name: "账号管理" }));
  await waitFor(() => expect(window.desktop.layoutAccountBrowser).toHaveBeenCalledWith(null));
  fireEvent.click(screen.getByRole("tab", { name: "Facebook 网站" }));
  fireEvent.click(screen.getByRole("button", { name: "关闭 Facebook 网站 标签页" }));
  await waitFor(() => expect(window.desktop.closeAccountBrowser).toHaveBeenCalledWith("account-1"));
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Facebook 网站" })).toBeNull());
  expect(screen.queryByRole("button", { name: "设置", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "打开头像菜单" }));
  expect(screen.getByRole("dialog", { name: "用户菜单" }).textContent).toContain("MediaX");
  fireEvent.click(screen.getByRole("button", { name: "设置", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "用户菜单" })).toBeNull());
  await waitFor(() =>
    expect((screen.getByLabelText("个人名称") as HTMLInputElement).value).toBe("MediaX"),
  );
  expect(screen.getByRole("button", { name: "更换头像" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("个人名称"), { target: { value: "张三" } });
  fireEvent.blur(screen.getByLabelText("个人名称"));
  await waitFor(() =>
    expect(window.desktop.setProfile).toHaveBeenCalledWith({ name: "张三", avatar: null }),
  );
  fireEvent.click(screen.getByRole("switch", { name: "静默发布" }));
  await waitFor(() => expect(window.desktop.setSilentPublish).toHaveBeenCalledWith(true));
  fireEvent.click(screen.getByRole("button", { name: "键盘快捷键" }));
  await screen.findByRole("heading", { name: "键盘快捷键" });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "编辑“全局呼出”的快捷键" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "编辑“全局呼出”的快捷键" }));
  const capture = await screen.findByLabelText("为“全局呼出”录制快捷键");
  fireEvent.keyDown(capture, {
    key: "F11",
    code: "F11",
    ctrlKey: true,
    altKey: true,
  });
  await waitFor(() =>
    expect(window.desktop.setGlobalShortcut).toHaveBeenCalledWith("Control+Alt+F11"),
  );
  await screen.findByText("已保存，可在其他应用中按快捷键呼出窗口。");
  fireEvent.click(screen.getByRole("button", { name: "清除“全局呼出”的快捷键" }));
  await waitFor(() => expect(window.desktop.setGlobalShortcut).toHaveBeenCalledWith(""));
  await screen.findByText("已关闭全局呼出快捷键。");
  expect(screen.queryByRole("dialog", { name: "设置", exact: true })).toBeNull();
  expect(screen.getByRole("main", { name: "设置页面" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回工作区" }));
  await choosePublishKind("发布图文");
  await waitFor(() => expect(screen.getByRole("heading", { name: "图文发布" })).toBeTruthy());
  await waitFor(() =>
    expect(
      screen.getByRole("tab", { name: "图文发布", exact: true }).getAttribute("aria-selected"),
    ).toBe("true"),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "导入 Markdown",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "导入 Markdown" }));
  await waitFor(() =>
    expect((screen.getByLabelText("描述") as HTMLTextAreaElement).value).toBe("Imported article"),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "一键发布",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() =>
    expect(window.desktop.saveDraft).toHaveBeenCalledWith("Imported article", [], "moment", ""),
  );
  fireEvent.change(screen.getByLabelText("描述"), {
    target: { value: "Latest draft from menu" },
  });
  await waitFor(() => expect(commandListener).toBeTypeOf("function"));
  await act(async () => {
    commandListener?.({ action: "save-draft" });
  });
  await waitFor(() =>
    expect(window.desktop.saveDraft).toHaveBeenCalledWith(
      "Latest draft from menu",
      [],
      "moment",
      "",
    ),
  );
  await act(async () => {
    commandListener?.({ action: "navigate", page: "history" });
  });
  expect(screen.getByRole("heading", { name: "发布记录", exact: true })).toBeTruthy();
  const target = {
    accountId: "account-1",
    identityId: "1001",
    name: "Verified Profile",
    kind: "profile",
  };
  const account = {
    id: "account-1",
    name: "Facebook 账号 1",
    platform: "facebook",
    login: "logged_in",
    targets: [target],
  };
  const jianshu = {
    id: "jianshu-1",
    name: "简书账号",
    platform: "jianshu",
    login: "logged_in",
    targets: [{ accountId: "jianshu-1", identityId: "1", name: "简书主页", kind: "profile" }],
  };
  const ximalaya = {
    id: "ximalaya-1",
    name: "喜马拉雅账号",
    platform: "ximalaya",
    login: "logged_in",
    targets: [{ accountId: "ximalaya-1", identityId: "1", name: "喜马拉雅主页", kind: "profile" }],
  };
  vi.mocked(window.desktop.accounts).mockResolvedValue([account, jianshu, ximalaya] as any);
  window.desktop.refreshAccount = vi.fn().mockResolvedValue(account);
  window.desktop.publish = vi.fn().mockResolvedValue("task-confirmed");
  window.desktop.publishBatches = vi.fn().mockResolvedValue("task-confirmed");
  fireEvent.click(screen.getByRole("button", { name: "账号管理", exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /AcFun/ }).querySelector("img")).toBeTruthy(),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "添加账号", exact: true }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "添加账号", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Facebook" }));
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Facebook 网站" }).getAttribute("aria-selected")).toBe(
      "true",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "关闭 Facebook 网站 标签页" }));
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Facebook 网站" })).toBeNull());
  fireEvent.click(screen.getByRole("tab", { name: "账号管理", exact: true }));
  await waitFor(() =>
    expect(
      (screen.getAllByRole("button", { name: "检查状态与发布身份" })[0] as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  const remove = screen.getByRole("button", { name: "删除 Facebook 账号 1" });
  expect(remove.className).toContain("text-destructive");
  fireEvent.click(screen.getByRole("button", { name: "删除 Facebook 账号 1" }));
  expect(screen.getByRole("heading", { name: "删除账号" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("heading", { name: "删除账号" })).toBeNull();
  let finishRefresh: (value: typeof account) => void = () => {};
  vi.mocked(window.desktop.refreshAccount).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "检查状态与发布身份" })[0]);
  expect((screen.getByRole("button", { name: "正在检查…" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(
    (screen.getByRole("button", { name: "添加账号", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(false);
  finishRefresh(account);
  expect(await screen.findByText("Facebook 账号 1：已登录")).toBeTruthy();
  await waitFor(() => expect(window.desktop.refreshAccount).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      (screen.getAllByRole("button", { name: "检查状态与发布身份" })[0] as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  await choosePublishKind("发布图文");
  expect(((await screen.findByLabelText("描述")) as HTMLTextAreaElement).value).toBe(
    "Latest draft from menu",
  );
  expect(screen.getAllByRole("button", { name: "添加图片" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /快速填写/ })).toBeTruthy();
  expect(screen.getByLabelText("标题")).toBeTruthy();
  expect(screen.getByRole("button", { name: "上传封面" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "打开头像菜单" }));
  expect(screen.getByRole("dialog", { name: "用户菜单" }).textContent).toContain("张三");
  fireEvent.click(screen.getByRole("button", { name: "设置", exact: true }));
  await screen.findByRole("main", { name: "设置页面" });
  await waitFor(() => expect(screen.getByLabelText("个人名称")).toBeTruthy());
  fireEvent.keyDown(window, { key: "Escape" });
  expect(((await screen.findByLabelText("描述")) as HTMLTextAreaElement).value).toBe(
    "Latest draft from menu",
  );
  fireEvent.change(screen.getByLabelText("描述"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "新增账号" }));
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /Verified Profile/ }).getAttribute("aria-disabled"),
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /Verified Profile/ }));
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /Verified Profile/ }).getAttribute("aria-checked"),
    ).toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "移除 Verified Profile" })).toBeTruthy(),
  );
  expect(
    (screen.getByRole("button", { name: "一键发布", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await choosePublishKind("发布文章");
  expect(screen.getByLabelText("标题")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "新增账号" }));
  await waitFor(() => expect(screen.getByRole("checkbox", { name: /简书主页/ })).toBeTruthy());
  expect(screen.queryByRole("checkbox", { name: /喜马拉雅主页/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  fireEvent.change(screen.getByLabelText("发布正文"), { target: { value: "Confirmed content" } });
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "确认标题" } });
  await choosePublishKind("发布视频");
  expect(screen.getByRole("heading", { name: "视频发布" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "添加本地视频" })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "一键发布", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await choosePublishKind("发布文章");
  expect(screen.getByRole("heading", { name: "文章发布" })).toBeTruthy();
  await waitFor(() =>
    expect((screen.getByLabelText("发布正文") as HTMLTextAreaElement).value).toBe(
      "Confirmed content",
    ),
  );
  await choosePublishKind("发布音频");
  expect(screen.getByRole("heading", { name: "音频发布" })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "一键发布", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await choosePublishKind("发布文章");
  await waitFor(() => expect(screen.getByRole("heading", { name: "文章发布" })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("发布正文"), { target: { value: "Confirmed content" } });
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "确认标题" } });
  // Facebook stays selected across article tabs when still supported
  if (!screen.queryByRole("button", { name: "移除 Verified Profile" })) {
    fireEvent.click(screen.getByRole("button", { name: "新增账号" }));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /Verified Profile/ }).getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Verified Profile/ }));
    fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "移除 Verified Profile" })).toBeTruthy(),
    );
  }
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "一键发布", exact: true }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect(screen.getByRole("button", { name: /快速填写/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "一键发布", exact: true }));
  expect(screen.getByRole("dialog", { name: "确认发布" })).toBeTruthy();
  expect(window.desktop.publishBatches).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消", exact: true }));
  expect(window.desktop.publishBatches).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "一键发布", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "确认发布", exact: true }));
  await waitFor(() =>
    expect(window.desktop.publishBatches).toHaveBeenCalledWith(
      "article",
      [],
      [{ title: "确认标题", body: "Confirmed content", targets: [target] }],
      null,
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "发布记录", exact: true })).toBeTruthy(),
  );
}, 15_000);
