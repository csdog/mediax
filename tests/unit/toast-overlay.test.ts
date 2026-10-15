import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { ToastOverlayWindow } from "../../src/main/desktop/ToastOverlayWindow";

const native = vi.hoisted(() => ({
  setBounds: vi.fn(),
  setVisible: vi.fn(),
  setBackgroundColor: vi.fn(),
  webContents: {
    loadURL: vi.fn().mockResolvedValue(undefined),
    executeJavaScript: vi.fn().mockResolvedValue(49.5),
    isDestroyed: vi.fn().mockReturnValue(false),
    close: vi.fn(),
  },
}));
vi.mock("electron", () => ({
  WebContentsView: class {
    constructor() {
      return native;
    }
  },
}));
beforeEach(() => vi.clearAllMocks());

it("measures toast content and stacks its native view above an external page", async () => {
  const parent = {
    isDestroyed: () => false,
    once: vi.fn(),
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  };
  const overlay = new ToastOverlayWindow(parent as unknown as BrowserWindow);
  await overlay.show({
    x: 97.5,
    y: 975,
    width: 1430,
    height: 1,
    toasts: [{ type: "success", title: "已保存" }],
  });
  expect(native.setBounds).toHaveBeenLastCalledWith({ x: 90, y: 918, width: 1446, height: 66 });
  expect(parent.contentView.addChildView).toHaveBeenCalledTimes(2);
  expect(native.setVisible).toHaveBeenLastCalledWith(true);
  overlay.hide();
  expect(parent.contentView.removeChildView).toHaveBeenCalledWith(native);
  expect(native.webContents.close).toHaveBeenCalledOnce();
});
