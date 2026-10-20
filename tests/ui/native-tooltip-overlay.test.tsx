// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useNativeTooltipOverlay } from "../../src/renderer/hooks/useNativeTooltipOverlay";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("mirrors an open tooltip into the native overlay while a page would cover it", async () => {
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
    showTooltipOverlay: show,
    hideTooltipOverlay: hide,
  } as unknown as typeof window.desktop;
  const tip = document.createElement("div");
  tip.setAttribute("data-slot", "tooltip-content");
  tip.setAttribute("data-open", "");
  tip.textContent = "刷新";
  tip.getBoundingClientRect = () => ({ x: 80, y: 48, width: 40, height: 24 }) as DOMRect;
  document.body.append(tip);
  function Harness({ enabled }: { enabled: boolean }) {
    useNativeTooltipOverlay(enabled);
    return null;
  }
  const view = render(<Harness enabled />);
  await waitFor(() =>
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ x: 80, y: 48, width: 40, height: 24, text: "刷新" }),
    ),
  );
  await waitFor(() => expect(tip.hasAttribute("data-native-mirrored")).toBe(true));
  view.rerender(<Harness enabled={false} />);
  expect(tip.hasAttribute("data-native-mirrored")).toBe(false);
  expect(hide).toHaveBeenCalled();
});
