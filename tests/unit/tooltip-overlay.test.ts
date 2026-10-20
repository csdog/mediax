import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { TooltipOverlayView } from "../../src/main/desktop/TooltipOverlayView";

const native = vi.hoisted(() => ({
  setBounds: vi.fn(),
  setVisible: vi.fn(),
  setBackgroundColor: vi.fn(),
  webContents: {
    loadURL: vi.fn().mockResolvedValue(undefined),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
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

it("stacks a tooltip above an external page and hides it without leaving the view focused", async () => {
  const parent = {
    isDestroyed: () => false,
    once: vi.fn(),
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  };
  const overlay = new TooltipOverlayView(parent as unknown as BrowserWindow);
  await overlay.show({
    x: 12.4,
    y: 40.2,
    width: 48,
    height: 28,
    text: "后退",
    background: "rgb(13, 13, 13)",
    color: "rgb(255, 255, 255)",
    radius: "12px",
  });
  expect(native.setBounds).toHaveBeenLastCalledWith({ x: 12, y: 40, width: 48, height: 28 });
  expect(native.webContents.executeJavaScript).toHaveBeenCalledWith(
    expect.stringContaining("后退"),
  );
  expect(parent.contentView.addChildView).toHaveBeenCalledTimes(2);
  expect(native.setVisible).toHaveBeenLastCalledWith(true);
  overlay.hide();
  expect(native.setVisible).toHaveBeenLastCalledWith(false);
  expect(native.webContents.close).not.toHaveBeenCalled();
});
