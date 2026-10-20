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
  destroy: vi.fn(),
};

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(() => fakeWindow),
  nativeImage: {
    createFromPath: vi.fn(() => ({ toDataURL: () => "data:image/png;base64,c3BsYXNo" })),
  },
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
    const loadedUrl = fakeWindow.loadURL.mock.calls[0][0] as string;
    expect(decodeURIComponent(loadedUrl)).toContain('src="data:image/png;base64,c3BsYXNo"');
    expect(decodeURIComponent(loadedUrl)).not.toContain("file://");
    readyHandlers.get("ready-to-show")!();
    expect(fakeWindow.showInactive).toHaveBeenCalledOnce();
    splash.open("/tmp/icon.png", windowBounds);
    expect(fakeWindow.setBounds).toHaveBeenCalledWith(windowBounds);
    splash.close();
    expect(fakeWindow.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the non-closable splash and ignores a late ready event", async () => {
    const { StartupSplash } = await import("../../src/main/desktop/StartupSplash");
    const splash = new StartupSplash();
    splash.open("/tmp/icon.png", { x: 0, y: 0, width: 1440, height: 900 });
    splash.close();
    splash.close();
    readyHandlers.get("ready-to-show")!();
    expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    expect(fakeWindow.showInactive).not.toHaveBeenCalled();
  });
});
