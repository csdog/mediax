// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useNativeToastOverlay } from "../../src/renderer/hooks/useNativeToastOverlay";

vi.mock("sonner", () => ({ useSonner: () => ({ toasts: [{ id: 1 }] }) }));

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("shows native toasts when Sonner's absolute children leave its host at zero height", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const show = vi.fn().mockResolvedValue(undefined);
  const hide = vi.fn().mockResolvedValue(undefined);
  window.desktop = {
    showToastOverlay: show,
    hideToastOverlay: hide,
  } as unknown as typeof window.desktop;
  const host = document.createElement("ol");
  host.setAttribute("data-sonner-toaster", "");
  host.innerHTML = '<li data-sonner-toast data-type="success"><span data-title>已保存</span></li>';
  host.getBoundingClientRect = () => ({ x: 100, y: 700, width: 600, height: 0 }) as DOMRect;
  document.body.append(host);
  function Harness({ enabled }: { enabled: boolean }) {
    useNativeToastOverlay(enabled);
    return null;
  }
  const view = render(<Harness enabled />);
  expect(show).toHaveBeenCalledWith({
    x: 100,
    y: 700,
    width: 600,
    height: 1,
    toasts: [{ type: "success", title: "已保存", description: undefined }],
  });
  view.rerender(<Harness enabled={false} />);
  expect(hide).toHaveBeenCalled();
});
