// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { ToastDemoPage } from "../../../src/renderer/demos/toast/ToastDemoPage";
vi.mock("sonner", () => ({
  useSonner: () => ({ toasts: [] }),
  toast: Object.assign(vi.fn(), {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 7),
    dismiss: vi.fn(),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("runs real toast scenarios, updates loading in place and cancels queued messages", () => {
  vi.useFakeTimers();
  window.desktop = { showToastOverlay: vi.fn() } as unknown as typeof window.desktop;
  render(<ToastDemoPage />);
  fireEvent.click(screen.getByRole("button", { name: "默认（黑色）", exact: true }));
  expect(toast).toHaveBeenCalledWith(
    "这是一条默认提示",
    expect.objectContaining({ duration: 6000 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "警告", exact: true }));
  expect(toast.warning).toHaveBeenCalledWith(
    "请先完成登录",
    expect.objectContaining({ duration: 6000 }),
  );
  fireEvent.click(screen.getByRole("button", { name: /连续弹出 3 条/ }));
  vi.advanceTimersByTime(480);
  expect(toast.info).toHaveBeenCalledWith("第 2 条提示", expect.anything());
  fireEvent.click(screen.getByRole("button", { name: /加载后更新同一条/ }));
  vi.advanceTimersByTime(1800);
  expect(toast.success).toHaveBeenCalledWith("演示内容已保存", expect.objectContaining({ id: 7 }));
  fireEvent.click(screen.getByRole("button", { name: /显示常驻提示/ }));
  expect(toast.info).toHaveBeenCalledWith(
    "这条提示会一直保留",
    expect.objectContaining({ duration: Infinity }),
  );
  fireEvent.click(screen.getByRole("button", { name: /连续弹出 6 条/ }));
  fireEvent.click(screen.getByRole("button", { name: "清空全部" }));
  const calls = vi.mocked(toast.info).mock.calls.length;
  vi.advanceTimersByTime(5000);
  expect(toast.info).toHaveBeenCalledTimes(calls);
  expect(toast.dismiss).toHaveBeenCalled();
});
it("explains that native previews require the desktop app", () => {
  window.desktop = {} as typeof window.desktop;
  render(<ToastDemoPage />);
  expect(screen.getByRole("alert").textContent).toContain("MediaX 开发版");
  expect(
    (screen.getByRole("button", { name: "成功", exact: true }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
