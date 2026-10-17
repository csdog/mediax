import { beforeEach, describe, expect, it, vi } from "vitest";

const readyHandlers = new Map<string, () => void>();
const fakeWindow = {
  isDestroyed: () => false,
  loadURL: vi.fn(),
  setBounds: vi.fn(),
  once: vi.fn((event: string, handler: () => void) => {
    readyHandlers.set(event, handler);
  }),
  showInactive: vi.fn(),
  close: vi.fn(),
};

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(() => fakeWindow),
  nativeTheme: { shouldUseDarkColors: false, prefersReducedTransparency: false },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
}));

describe("StartupSplash", () => {
  beforeEach(() => {
    readyHandlers.clear();
    vi.clearAllMocks();
  });

  it("shows a full-size splash and aligns it to the main window", async () => {
    const { StartupSplash } = await import("../../src/main/desktop/StartupSplash");
    const splash = new StartupSplash();
    const workArea = { x: 0, y: 0, width: 1440, height: 900 };
    const windowBounds = { x: 120, y: 80, width: 1280, height: 800 };
    splash.open("/tmp/icon.png", workArea);
    expect(fakeWindow.loadURL).toHaveBeenCalledOnce();
    readyHandlers.get("ready-to-show")!();
    expect(fakeWindow.showInactive).toHaveBeenCalledOnce();
    splash.open("/tmp/icon.png", windowBounds);
    expect(fakeWindow.setBounds).toHaveBeenCalledWith(windowBounds);
    splash.close();
    expect(fakeWindow.close).toHaveBeenCalledOnce();
  });
});
