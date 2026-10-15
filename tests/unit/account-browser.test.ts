import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { AccountBrowserManager } from "../../src/main/browser/AccountBrowserManager";
import { platforms } from "../../src/shared/models";

const state = vi.hoisted(() => ({ destroyed: false }));
const view = vi.hoisted(() => ({
  setBounds: vi.fn(),
  setVisible: vi.fn(),
  setBorderRadius: vi.fn(),
  webContents: {
    isDestroyed: () => state.destroyed,
    getURL: () => "https://mp.toutiao.com/",
    getUserAgent: () =>
      "Mozilla/5.0 MediaX/0.3.5 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36",
    setUserAgent: vi.fn(),
    on: vi.fn(),
    loadURL: vi.fn(),
    setBackgroundThrottling: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    close: vi.fn(() => {
      state.destroyed = true;
    }),
  },
}));
vi.mock("electron", () => ({
  WebContentsView: class {
    constructor() {
      return view;
    }
  },
}));

function manager() {
  const host = {
    on: vi.fn(),
    webContents: { on: vi.fn() },
    isDestroyed: () => false,
    getContentSize: () => [1000, 700],
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  };
  return new AccountBrowserManager(host as unknown as BrowserWindow);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.destroyed = false;
});

it.each([false, true])(
  "treats closing a loading tab as cancellation (existing: %s)",
  async (existing) => {
    const browsers = manager();
    view.webContents.loadURL.mockResolvedValueOnce(undefined);
    if (existing) await browsers.open("account-1", "https://mp.toutiao.com/", { focus: false });
    view.webContents.loadURL.mockReset();
    let rejectLoad!: (error: Error) => void;
    view.webContents.loadURL.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        }),
    );
    const opening = browsers.open("account-1", "https://mp.toutiao.com/auth/page/login", {
      focus: false,
    });
    browsers.close("account-1");
    rejectLoad(new Error("ERR_FAILED (-2) loading login"));
    await expect(opening).resolves.toBe(view);
    expect(browsers.get("account-1")).toBeUndefined();
  },
);

it("still reports navigation failures while the tab remains open", async () => {
  const browsers = manager();
  const failure = new Error("ERR_FAILED (-2) loading login");
  view.webContents.loadURL.mockRejectedValueOnce(failure);
  await expect(browsers.open("account-1", "https://mp.toutiao.com/auth/page/login")).rejects.toBe(
    failure,
  );
});

it.each([...platforms, undefined])(
  "uses the native Chrome UA without shell tokens for %s",
  async (platform) => {
    view.webContents.loadURL.mockResolvedValueOnce(undefined);
    await manager().open("account-1", "https://channels.weixin.qq.com/platform", {
      platform,
      focus: false,
    });
    const ua = view.webContents.setUserAgent.mock.calls[0][0];
    expect(ua).toContain("Chrome/152.0.7977.130");
    expect(ua).not.toMatch(/Electron|MediaX/);
    expect(view.webContents.setUserAgent.mock.invocationCallOrder[0]).toBeLessThan(
      view.webContents.loadURL.mock.invocationCallOrder[0],
    );
  },
);
