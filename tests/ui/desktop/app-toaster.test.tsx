// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { AppToaster } from "../../../src/renderer/components/AppToaster";
import type { NativeToastEvent } from "../../../src/shared/models";

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["default", "warning", "info", "success", "error", "loading"] as const)(
  "sends %s messages directly to the native view without hidden HTML",
  async (type) => {
    const show = vi.fn().mockResolvedValue(undefined);
    const hide = vi.fn().mockResolvedValue(undefined);
    let dismiss!: (event: Extract<NativeToastEvent, { type: "dismiss" }>) => void;
    window.desktop = {
      showToastOverlay: show,
      hideToastOverlay: hide,
      onNativeToastDismissed: (listener: typeof dismiss) => {
        dismiss = listener;
        return () => {};
      },
    } as unknown as typeof window.desktop;
    render(<AppToaster />);
    let id!: number | string;
    act(() => {
      id =
        type === "default"
          ? toast("默认提示")
          : toast[type]("asir：未登录，请在账号标签页中登录 视频号");
    });
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          toasts: expect.arrayContaining([
            expect.objectContaining({
              id,
              type,
              duration: type === "loading" ? null : 5000,
              icon: expect.stringContaining("data:image/svg+xml,"),
            }),
          ]),
        }),
      ),
    );
    expect(document.querySelector("[data-sonner-toaster]")).toBeNull();
    act(() => dismiss({ type: "dismiss", id, reason: "close" }));
    await waitFor(() =>
      expect(
        show.mock.calls.at(-1)![0].toasts.some((item: { id: string | number }) => item.id === id),
      ).toBe(false),
    );
    cleanup();
    expect(hide).toHaveBeenCalled();
  },
);
