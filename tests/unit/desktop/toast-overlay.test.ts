import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { ToastOverlayWindow } from "../../../src/main/desktop/ToastOverlayWindow";

const native = vi.hoisted(() => ({
  setBounds: vi.fn(),
  setVisible: vi.fn(),
  setBackgroundColor: vi.fn(),
  webContents: {
    mainFrame: {},
    loadURL: vi.fn().mockResolvedValue(undefined),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    isDestroyed: () => false,
    close: vi.fn(),
  },
}));
const ipc = vi.hoisted(() => ({ on: vi.fn(), removeListener: vi.fn() }));
vi.mock("electron", () => ({
  ipcMain: ipc,
  WebContentsView: class {
    constructor() {
      return native;
    }
  },
}));
beforeEach(() => vi.clearAllMocks());
const parent = () => ({
  isDestroyed: () => false,
  once: vi.fn(),
  getContentSize: () => [1600, 1100],
  webContents: { send: vi.fn(), on: vi.fn() },
  contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
});
const payload = {
  x: 97.5,
  y: 975,
  width: 420,
  height: 1,
  toasts: [{ id: 1, type: "success", title: "已保存", duration: 5000 }],
};
const emit = (data: unknown, sender: unknown = native.webContents) =>
  ipc.on.mock.calls[0][1]({ sender, senderFrame: native.webContents.mainFrame }, data);

it("resizes around the bottom anchor as the native stack expands and collapses", async () => {
  const host = parent();
  const overlay = new ToastOverlayWindow(host as unknown as BrowserWindow);
  await overlay.show(payload);
  emit({ type: "resize", height: 74 });
  expect(native.setBounds).toHaveBeenLastCalledWith({ x: 86, y: 914, width: 444, height: 74 });
  emit({ type: "resize", height: 194 });
  expect(native.setBounds).toHaveBeenLastCalledWith({ x: 86, y: 794, width: 444, height: 194 });
  await overlay.show({ ...payload, toasts: [] });
  expect(native.webContents.close).not.toHaveBeenCalled();
  emit({ type: "empty" });
  expect(native.setVisible).toHaveBeenLastCalledWith(false);
  overlay.hide();
  expect(host.contentView.removeChildView).toHaveBeenCalledWith(native);
});

it("accepts events only from the native toast view and validates dismissals", async () => {
  const host = parent();
  const overlay = new ToastOverlayWindow(host as unknown as BrowserWindow);
  await overlay.show(payload);
  const calls = native.setBounds.mock.calls.length;
  emit({ type: "resize", height: 200 }, {});
  emit({ type: "resize", height: NaN });
  expect(native.setBounds).toHaveBeenCalledTimes(calls);
  emit({ type: "dismiss", id: "unknown", reason: "close" });
  expect(host.webContents.send).not.toHaveBeenCalled();
  emit({ type: "dismiss", id: 1, reason: "close" });
  expect(host.webContents.send).toHaveBeenCalledWith("mediax:toast-dismissed", {
    type: "dismiss",
    id: 1,
    reason: "close",
  });
});

it("clears native cards when switching between the workspace and a standalone demo page", async () => {
  const host = parent();
  const overlay = new ToastOverlayWindow(host as unknown as BrowserWindow);
  await overlay.show(payload);
  const navigate = host.webContents.on.mock.calls.find(
    ([name]) => name === "did-start-navigation",
  )![1];
  navigate({}, "http://127.0.0.1/toast-demo.html", false, false);
  expect(native.webContents.close).not.toHaveBeenCalled();
  navigate({}, "http://127.0.0.1/toast-demo.html", false, true);
  expect(native.webContents.close).toHaveBeenCalledOnce();
});
