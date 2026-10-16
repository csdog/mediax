// @vitest-environment jsdom
import "./setup";
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NativePopupApp } from "../../src/renderer/native-popup/NativePopupApp";
import type { NativePopupRequest } from "../../src/shared/models";

it("highlights the whole history row on hover, clears it on exit, and keeps keyboard selection", async () => {
  let receive!: (popup: NativePopupRequest) => void;
  const notify = vi.fn();
  window.desktop = {
    onNativePopup: vi.fn((listener) => {
      receive = listener;
      return () => {};
    }),
    notifyNativePopup: notify,
  } as unknown as typeof window.desktop;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const user = userEvent.setup();
  render(<NativePopupApp />);
  act(() =>
    receive({
      kind: "history",
      theme: "light",
      x: 0,
      y: 0,
      width: 600,
      historyIndex: 0,
      historySearchQuery: "搜索词",
      historyEntries: [
        { url: "https://example.com/one", title: "第一条", visitedAt: 1 },
        { url: "https://example.com/two", title: "第二条", visitedAt: 2 },
      ],
    }),
  );
  const [first, second] = screen.getAllByRole("option");
  const selection = window.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(screen.getByRole("listbox"));
  selection.addRange(range);
  expect(selection.toString()).toContain("第一条");
  fireEvent.pointerDown(within(second).getByText("第二条"));
  expect(selection.toString()).toBe("");

  await user.hover(within(second).getByText("第二条"));
  expect(second.dataset.hover).toBe("true");
  expect(first.getAttribute("aria-selected")).toBe("true");
  await user.hover(within(second).getByRole("button", { name: "从历史记录中删除" }));
  expect(second.dataset.hover).toBe("true");
  await user.hover(within(first).getByText("第一条"));
  expect(second.dataset.hover).toBeUndefined();
  expect(first.dataset.hover).toBe("true");
  await user.unhover(first);
  expect(first.dataset.hover).toBeUndefined();
  const search = screen.getByRole("option", { name: "搜索词" });
  await user.hover(search);
  expect(search.dataset.hover).toBe("true");
  await user.unhover(search);
  expect(search.dataset.hover).toBeUndefined();
  const open = within(first).getByRole("button", { name: /第一条/ });
  notify.mockClear();
  fireEvent.mouseDown(open, { button: 0 });
  expect(notify).not.toHaveBeenCalled();
  fireEvent.mouseUp(open, { button: 0 });
  fireEvent.click(open);
  expect(notify).toHaveBeenCalledExactlyOnceWith({
    type: "action",
    action: { type: "open-history", url: "https://example.com/one" },
  });
  notify.mockClear();
  fireEvent.mouseDown(open, { button: 2 });
  fireEvent.contextMenu(open);
  expect(notify).not.toHaveBeenCalled();
  await user.click(within(second).getByRole("button", { name: "从历史记录中删除" }));
  expect(notify).toHaveBeenCalledExactlyOnceWith({
    type: "action",
    action: { type: "remove-history", url: "https://example.com/two" },
  });
  notify.mockClear();
  await user.click(search);
  expect(notify).toHaveBeenCalledExactlyOnceWith({
    type: "action",
    action: { type: "submit-omnibox", value: "搜索词" },
  });
});
