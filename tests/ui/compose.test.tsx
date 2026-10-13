// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { App } from "../../src/renderer/src";
// jsdom has no native preload; exercise real logging in Electron integration instead.
vi.mock("../../src/renderer/lib/logging", () => ({ initializeRendererLogging: vi.fn() }));
it("imports and saves content, manages desktop tabs/settings, and requires target selection plus publish confirmation", async () => {
  let commandListener: ((command: any) => void) | undefined;
  window.desktop = {
    onCommand: vi.fn((listener) => {
      commandListener = listener;
      return () => {
        commandListener = undefined;
      };
    }),
    shortcutSettings: vi
      .fn()
      .mockResolvedValue({ accelerator: "CommandOrControl+Shift+Space", registered: true }),
    setGlobalShortcut: vi.fn().mockImplementation(async (accelerator) => ({
      accelerator,
      registered: Boolean(accelerator),
    })),
    publishSettings: vi.fn().mockResolvedValue({ silent: false }),
    setSilentPublish: vi.fn().mockImplementation(async (silent: boolean) => ({ silent })),
    accounts: vi.fn().mockResolvedValue([]),
    addAccount: vi.fn().mockResolvedValue({
      id: "account-1",
      name: "Facebook 账号 1",
      login: "unchecked",
      targets: [],
    }),
    layoutAccountBrowser: vi.fn().mockResolvedValue(undefined),
    closeAccountBrowser: vi.fn().mockResolvedValue(undefined),
    openAccount: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue({ tasks: [], targets: [] }),
    loadDraft: vi.fn().mockResolvedValue({ body: "", images: [] }),
    importMarkdown: vi.fn().mockResolvedValue("Imported article"),
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
  fireEvent.click(screen.getByRole("button", { name: "添加账号", exact: true }));
  expect(screen.getByRole("dialog", { name: "添加账号" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "开始授权" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: /Facebook/ }));
  expect(window.desktop.addAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "开始授权" }));
  await waitFor(() => expect(window.desktop.openAccount).toHaveBeenCalledWith("account-1"));
  expect(window.desktop.addAccount).toHaveBeenCalledWith("Facebook 账号 1");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("tab", { name: "Facebook 账号 1" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("tab", { name: "账号管理" }));
  await waitFor(() => expect(window.desktop.layoutAccountBrowser).toHaveBeenCalledWith(null));
  fireEvent.click(screen.getByRole("tab", { name: "Facebook 账号 1" }));
  fireEvent.click(screen.getByRole("button", { name: "关闭 Facebook 账号 1 标签页" }));
  await waitFor(() => expect(window.desktop.closeAccountBrowser).toHaveBeenCalledWith("account-1"));
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Facebook 账号 1" })).toBeNull());
  expect(screen.queryByRole("button", { name: "设置", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "打开头像菜单" }));
  expect(screen.getByRole("dialog", { name: "用户菜单" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "设置", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "用户菜单" })).toBeNull());
  await waitFor(() =>
    expect((screen.getByLabelText("全局呼出快捷键") as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole("switch", { name: "静默发布" }));
  await waitFor(() => expect(window.desktop.setSilentPublish).toHaveBeenCalledWith(true));
  fireEvent.keyDown(screen.getByLabelText("全局呼出快捷键"), {
    key: "F11",
    code: "F11",
    ctrlKey: true,
    altKey: true,
  });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  await waitFor(() =>
    expect(window.desktop.setGlobalShortcut).toHaveBeenCalledWith("Control+Alt+F11"),
  );
  await screen.findByText("已保存，可在其他应用中按快捷键呼出窗口。");
  fireEvent.click(screen.getByRole("button", { name: "清除快捷键" }));
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  await waitFor(() => expect(window.desktop.setGlobalShortcut).toHaveBeenCalledWith(""));
  await screen.findByText("已关闭全局呼出快捷键。");
  expect(screen.queryByRole("dialog", { name: "设置", exact: true })).toBeNull();
  expect(screen.getByRole("main", { name: "设置页面" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回工作区" }));
  fireEvent.click(screen.getByRole("button", { name: "内容发布" }));
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
    expect((screen.getByLabelText("发布正文") as HTMLTextAreaElement).value).toBe(
      "Imported article",
    ),
  );
  expect(screen.getByText("Imported article", { selector: "p" })).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "发布",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() =>
    expect(window.desktop.saveDraft).toHaveBeenCalledWith("Imported article", []),
  );
  fireEvent.change(screen.getByLabelText("发布正文"), {
    target: { value: "Latest draft from menu" },
  });
  await waitFor(() => expect(commandListener).toBeTypeOf("function"));
  await act(async () => {
    commandListener?.({ action: "save-draft" });
  });
  await waitFor(() =>
    expect(window.desktop.saveDraft).toHaveBeenCalledWith("Latest draft from menu", []),
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
    login: "logged_in",
    targets: [target],
  };
  vi.mocked(window.desktop.accounts).mockResolvedValue([account] as any);
  window.desktop.refreshAccount = vi.fn().mockResolvedValue(account);
  window.desktop.publish = vi.fn().mockResolvedValue("task-confirmed");
  fireEvent.click(screen.getByRole("button", { name: "账号管理", exact: true }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "添加账号", exact: true }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "添加账号", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /Facebook/ }));
  fireEvent.click(screen.getByRole("button", { name: "开始授权", exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Facebook 账号 1" }).getAttribute("aria-selected")).toBe(
      "true",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "关闭 Facebook 账号 1 标签页" }));
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "检查状态" }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "删除 Facebook 账号 1" }));
  expect(screen.getByRole("heading", { name: "删除账号" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("heading", { name: "删除账号" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "检查状态" }));
  await waitFor(() => expect(window.desktop.refreshAccount).toHaveBeenCalled());
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "检查状态" }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "内容发布", exact: true }));
  expect(((await screen.findByLabelText("发布正文")) as HTMLTextAreaElement).value).toBe(
    "Latest draft from menu",
  );
  fireEvent.click(screen.getByRole("button", { name: "打开头像菜单" }));
  fireEvent.click(screen.getByRole("button", { name: "设置", exact: true }));
  await screen.findByRole("main", { name: "设置页面" });
  await waitFor(() =>
    expect((screen.getByLabelText("全局呼出快捷键") as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.keyDown(window, { key: "Escape" });
  expect(((await screen.findByLabelText("发布正文")) as HTMLTextAreaElement).value).toBe(
    "Latest draft from menu",
  );
  fireEvent.change(screen.getByLabelText("发布正文"), { target: { value: "" } });
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
  expect(
    (screen.getByRole("button", { name: "发布", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("发布正文"), { target: { value: "Confirmed content" } });
  fireEvent.click(screen.getByRole("button", { name: "发布", exact: true }));
  expect(screen.getByRole("dialog", { name: "确认发布" })).toBeTruthy();
  expect(window.desktop.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消", exact: true }));
  expect(window.desktop.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "发布", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "确认发布", exact: true }));
  await waitFor(() =>
    expect(window.desktop.publish).toHaveBeenCalledWith("Confirmed content", [], [target]),
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "发布记录", exact: true })).toBeTruthy(),
  );
});
