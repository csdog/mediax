// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../../src/renderer/src";

vi.mock("../../src/renderer/lib/logging", () => ({ initializeRendererLogging: vi.fn() }));

it("lists publish records with filters from the reference layout", async () => {
  window.desktop = {
    onCommand: vi.fn(() => () => undefined),
    shortcutSettings: vi
      .fn()
      .mockResolvedValue({ accelerator: "CommandOrControl+M", registered: true }),
    publishSettings: vi.fn().mockResolvedValue({ silent: false }),
    setSilentPublish: vi.fn().mockResolvedValue({ silent: false }),
    profileSettings: vi.fn().mockResolvedValue({ name: "media-post", avatar: null }),
    setProfile: vi.fn().mockImplementation(async (profile) => profile),
    chooseAvatar: vi.fn().mockResolvedValue(null),
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
