import { beforeEach, describe, expect, it, vi } from "vitest";

const readyHandlers = new Map<string, () => void>();
const fakeWindow = {
  isDestroyed: () => false,
  loadURL: vi.fn(),
  once: vi.fn((event: string, handler: () => void) => {
    readyHandlers.set(event, handler);
  }),
  showInactive: vi.fn(),
  close: vi.fn(),
};

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(() => fakeWindow),
  nativeTheme: { shouldUseDarkColors: false },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
}));

describe("StartupSplash", () => {
  beforeEach(() => {
    readyHandlers.clear();
    vi.clearAllMocks();
  });

  it("shows a frameless splash and closes it", async () => {
    const { StartupSplash } = await import("../../src/main/desktop/StartupSplash");
    const splash = new StartupSplash();
    splash.open("/tmp/icon.png");
    expect(fakeWindow.loadURL).toHaveBeenCalledOnce();
    const loaded = String(fakeWindow.loadURL.mock.calls[0][0]);
    expect(loaded).toContain(encodeURIComponent('src="file://'));
    readyHandlers.get("ready-to-show")!();
    expect(fakeWindow.showInactive).toHaveBeenCalledOnce();
    splash.close();
    expect(fakeWindow.close).toHaveBeenCalledOnce();
  });
});
