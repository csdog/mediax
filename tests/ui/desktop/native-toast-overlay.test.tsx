// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installNativeToasts } from "../../../src/main/desktop/nativeToast";
import type { ToastOverlay, ToastOverlayItem } from "../../../src/shared/models";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(50);
  document.body.innerHTML = "<div data-native-toaster></div>";
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const item = (id: number, patch: Partial<ToastOverlayItem> = {}): ToastOverlayItem => ({
  id,
  type: "info",
  title: `通知 ${id}`,
  duration: 5000,
  ...patch,
});
const data = (toasts: ToastOverlayItem[]): ToastOverlay => ({
  width: 420,
  x: 100,
  y: 700,
  height: 1,
  toasts,
});

it("keeps cards stable across updates and animates entry and removal", () => {
  const notify = vi.fn();
  const render = installNativeToasts(notify);
  render(data([item(1)]));
  const card = document.querySelector<HTMLElement>(".native-toast")!;
  expect(card.dataset.phase).toBe("entering");
  vi.advanceTimersByTime(40);
  expect(card.dataset.phase).toBe("visible");
  render(data([item(1, { title: "已更新", type: "success" })]));
  expect(document.querySelector(".native-toast")).toBe(card);
  expect(card.textContent).toContain("已更新");
  render(data([]));
  expect(card.dataset.phase).toBe("leaving");
  expect(card.isConnected).toBe(true);
  vi.advanceTimersByTime(240);
  expect(card.isConnected).toBe(false);
  vi.advanceTimersByTime(240);
  expect(notify).toHaveBeenCalledWith({ type: "empty" });
});

it("expands three stacked cards on hover, then shrinks only after the transition", () => {
  const notify = vi.fn();
  const render = installNativeToasts(notify);
  render(data([item(3), item(2), item(1)]));
  vi.advanceTimersByTime(240);
  const host = document.querySelector<HTMLElement>("[data-native-toaster]")!;
  expect(host.style.height).toBe("69px");
  host.dispatchEvent(new Event("pointerenter"));
  expect(host.dataset.expanded).toBe("true");
  expect(host.style.height).toBe("170px");
  expect(notify).toHaveBeenLastCalledWith({ type: "resize", height: 194 });
  host.dispatchEvent(new Event("pointerleave"));
  expect(host.style.height).toBe("170px");
  vi.advanceTimersByTime(240);
  expect(host.style.height).toBe("69px");
});

it("pauses expiry during hover and focus, then resumes the remaining duration", () => {
  const notify = vi.fn();
  const render = installNativeToasts(notify);
  render(data([item(1, { duration: 500 })]));
  vi.advanceTimersByTime(200);
  const host = document.querySelector<HTMLElement>("[data-native-toaster]")!;
  host.dispatchEvent(new Event("pointerenter"));
  host.dispatchEvent(new Event("focusin"));
  host.dispatchEvent(new Event("pointerleave"));
  vi.advanceTimersByTime(2000);
  expect(notify.mock.calls.some(([event]) => event.type === "dismiss")).toBe(false);
  host.dispatchEvent(new FocusEvent("focusout"));
  vi.advanceTimersByTime(299);
  expect(notify.mock.calls.some(([event]) => event.type === "dismiss")).toBe(false);
  vi.advanceTimersByTime(1);
  expect(notify).toHaveBeenCalledWith({ type: "dismiss", id: 1, reason: "timeout" });
});

it("queues extra cards, preserves indefinite loading and closes by keyboard", () => {
  const notify = vi.fn();
  const render = installNativeToasts(notify);
  render(
    data([
      item(4, { duration: null, type: "loading", dismissible: false }),
      item(3, { duration: null }),
      item(2, { duration: null }),
      item(1),
    ]),
  );
  expect(
    [...document.querySelectorAll<HTMLElement>(".native-toast")].filter((node) => !node.hidden),
  ).toHaveLength(3);
  vi.advanceTimersByTime(6000);
  expect(notify.mock.calls.some(([event]) => event.type === "dismiss")).toBe(false);
  document
    .querySelector("[data-native-toaster]")!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(notify).toHaveBeenCalledWith({ type: "dismiss", id: 3, reason: "close" });
  expect(document.querySelectorAll<HTMLElement>(".native-toast")[0].dataset.phase).toBe("visible");
});

it("resets hover state after the last card exits so a later toast can expire", () => {
  const notify = vi.fn();
  const render = installNativeToasts(notify);
  render(data([item(1)]));
  const host = document.querySelector<HTMLElement>("[data-native-toaster]")!;
  host.dispatchEvent(new Event("pointerenter"));
  render(data([]));
  vi.advanceTimersByTime(480);
  expect(host.dataset.expanded).toBe("false");
  render(data([item(2, { duration: 500 })]));
  vi.advanceTimersByTime(500);
  expect(notify).toHaveBeenCalledWith({ type: "dismiss", id: 2, reason: "timeout" });
});
