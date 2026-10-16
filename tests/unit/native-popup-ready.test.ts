import { expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import type { NativePopupRequest } from "../../src/shared/models";
const fake = vi.hoisted(() => ({
  events: new Map<string, (...args: unknown[]) => void>(),
  send: vi.fn(),
  visible: false,
}));
vi.mock("electron", () => ({
  WebContentsView: class {
    webContents = {
      send: fake.send,
      isDestroyed: () => false,
      on: (name: string, fn: (...args: unknown[]) => void) => fake.events.set(name, fn),
      loadURL: () => Promise.resolve(),
      loadFile: () => Promise.resolve(),
    };
    setBounds() {}
    setBackgroundColor() {}
    setVisible(value: boolean) {
      fake.visible = value;
    }
  },
}));
vi.mock("../../src/main/logging", () => ({ log: { debug: vi.fn() } }));
import { NativePopupView, parseNativePopup } from "../../src/main/desktop/NativePopupView";

it("delivers pending popup data only after the renderer subscribes, including after reload", () => {
  const focus = vi.fn();
  const emit = vi.fn();
  const parent = {
    webContents: { focus },
    isDestroyed: () => false,
    contentView: { addChildView: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
  } as unknown as BrowserWindow;
  const popup = new NativePopupView(parent, emit);
  const request: NativePopupRequest = {
    kind: "history",
    theme: "light",
    x: 0,
    y: 0,
    width: 600,
  };
  expect(parseNativePopup(request)).toEqual(request);
  popup.show(request);
  expect(fake.send).not.toHaveBeenCalled();
  expect(fake.visible).toBe(false);
  popup.rendererReady();
  expect(fake.send).toHaveBeenLastCalledWith("mediax:native-popup", request);
  expect(fake.visible).toBe(true);
  fake.send.mockClear();
  fake.events.get("did-start-loading")!();
  const next = { ...request, historySearchQuery: "next" };
  popup.show(next);
  expect(fake.send).not.toHaveBeenCalled();
  popup.rendererReady();
  expect(fake.send).toHaveBeenCalledExactlyOnceWith("mediax:native-popup", next);
  fake.events.get("focus")!();
  expect(focus).toHaveBeenCalledOnce();
  expect(emit).toHaveBeenLastCalledWith({ type: "focus-omnibox" });
  expect(fake.visible).toBe(true);
  focus.mockClear();
  const selectAll = { preventDefault: vi.fn() };
  const input = fake.events.get("before-input-event")!;
  input(selectAll, { type: "keyDown", key: "a", control: true });
  input(selectAll, { type: "keyDown", key: "A", meta: true });
  expect(selectAll.preventDefault).toHaveBeenCalledTimes(2);
  expect(fake.visible).toBe(true);
  input(selectAll, { type: "keyUp", key: "a", control: true });
  input(selectAll, { type: "keyDown", key: "ArrowLeft" });
  expect(selectAll.preventDefault).toHaveBeenCalledTimes(2);
  const event = { preventDefault: vi.fn() };
  fake.events.get("before-input-event")!(event, { type: "keyUp", key: "Escape" });
  expect(fake.visible).toBe(true);
  fake.events.get("before-input-event")!(event, { type: "keyDown", key: "Escape" });
  expect(fake.visible).toBe(false);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(emit).toHaveBeenCalledWith({ type: "closed" });
  expect(focus).toHaveBeenCalledOnce();
});
