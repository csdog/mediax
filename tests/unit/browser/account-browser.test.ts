import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { AccountBrowserManager } from "../../../src/main/browser/AccountBrowserManager";
import { loadFavicon } from "../../../src/main/browser/favicon";
import { platforms } from "../../../src/shared/models";
vi.mock("../../../src/main/browser/contextMenu", () => ({
  installBrowserContextMenu: vi.fn(async () => {}),
}));

vi.mock("../../../src/main/browser/favicon", () => ({
  loadFavicon: vi.fn(async () => "data:image/png;base64,aWNvbg=="),
}));

const state = vi.hoisted(() => ({ destroyed: false, loading: false }));
const view = vi.hoisted(() => ({
  setBounds: vi.fn(),
  setVisible: vi.fn(),
  setBorderRadius: vi.fn(),
  webContents: {
    isDestroyed: () => state.destroyed,
    getTitle: () => "Example",
    navigationHistory: { canGoBack: () => true, canGoForward: () => false },
    isLoadingMainFrame: () => state.loading,
    getURL: () => "https://mp.toutiao.com/",
    getUserAgent: () =>
      "Mozilla/5.0 MediaX/0.3.5 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36",
    setUserAgent: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
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
    webContents: { on: vi.fn(), send: vi.fn() },
    isDestroyed: () => false,
    getContentSize: () => [1000, 700],
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  };
  return new AccountBrowserManager(host as unknown as BrowserWindow);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.destroyed = false;
  state.loading = false;
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

it("can inspect a ready document while slow subresources keep the full load pending", async () => {
  let domReady!: () => void;
  let finishLoad!: () => void;
  view.webContents.once.mockImplementationOnce((_event, listener) => {
    domReady = listener;
  });
  view.webContents.loadURL.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishLoad = resolve;
      }),
  );
  const opening = manager().open("account-1", "https://mp.toutiao.com/auth/page/login", {
    focus: false,
    platform: "toutiao",
    waitUntil: "dom-ready",
  });
  domReady();
  await expect(opening).resolves.toBe(view);
  expect(view.webContents.removeListener).toHaveBeenCalledWith("dom-ready", domReady);
  finishLoad();
});

it("reports real document failures before DOM readiness and removes the listener", async () => {
  view.webContents.loadURL.mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"));
  await expect(
    manager().open("account-1", "https://mp.toutiao.com/auth/page/login", {
      focus: false,
      waitUntil: "dom-ready",
    }),
  ).rejects.toThrow("ERR_CONNECTION_REFUSED");
  expect(view.webContents.removeListener).toHaveBeenCalledWith("dom-ready", expect.any(Function));
});

it("handles Electron clearing a closed view's webContents during navigation", async () => {
  const contents = view.webContents;
  let rejectLoad!: (error: Error) => void;
  contents.loadURL.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectLoad = reject;
      }),
  );
  const browsers = manager();
  const opening = browsers.open("account-1", "https://mp.toutiao.com/auth/page/login", {
    focus: false,
  });
  browsers.close("account-1");
  Object.defineProperty(view, "webContents", { configurable: true, value: undefined });
  try {
    rejectLoad(new Error("ERR_ABORTED"));
    await expect(opening).resolves.toBe(view);
  } finally {
    Object.defineProperty(view, "webContents", { configurable: true, value: contents });
  }
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

it("opens account popup links in the same view to preserve the logged-in session", async () => {
  view.webContents.loadURL.mockResolvedValue(undefined);
  await manager().open("account-1", "https://www.zhihu.com/", { focus: false });
  const handler = view.webContents.setWindowOpenHandler.mock.calls[0][0];
  view.webContents.loadURL.mockClear();
  expect(handler({ url: "https://www.zhihu.com/creator" })).toEqual({ action: "deny" });
  expect(view.webContents.loadURL).toHaveBeenCalledWith("https://www.zhihu.com/creator");
});

it.each(["javascript:alert(1)", "file:///tmp/test.html", "invalid", "about:blank"])(
  "does not load unsafe or unsupported popup URL %s",
  async (url) => {
    view.webContents.loadURL.mockResolvedValue(undefined);
    await manager().open("account-1", "https://www.zhihu.com/", { focus: false });
    const handler = view.webContents.setWindowOpenHandler.mock.calls[0][0];
    view.webContents.loadURL.mockClear();
    expect(handler({ url })).toEqual({ action: "deny" });
    expect(view.webContents.loadURL).not.toHaveBeenCalled();
  },
);

it("publishes main-frame navigation and redirects before loading completes", async () => {
  const send = vi.fn();
  const host = {
    on: vi.fn(),
    webContents: { on: vi.fn(), send },
    isDestroyed: () => false,
    getContentSize: () => [1000, 700],
    contentView: { addChildView: vi.fn() },
  };
  const browsers = new AccountBrowserManager(host as unknown as BrowserWindow);
  let finish!: () => void;
  view.webContents.loadURL.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const opening = browsers.open("web-test", "https://example.com", { focus: false });
  const emit = (name: string, ...args: unknown[]) => {
    for (const [event, listener] of view.webContents.on.mock.calls) {
      if (event === name) listener({}, ...args);
    }
  };
  emit("did-start-navigation", "https://example.com/start", false, false);
  expect(send).not.toHaveBeenCalled();
  emit("did-start-navigation", "https://example.com/start", false, true);
  expect(send).toHaveBeenLastCalledWith(
    "mediax:browser-navigation-changed",
    "web-test",
    expect.objectContaining({ url: "https://example.com/start" }),
  );
  emit("did-redirect-navigation", "https://example.com/final", false, true);
  expect(send).toHaveBeenLastCalledWith(
    "mediax:browser-navigation-changed",
    "web-test",
    expect.objectContaining({ url: "https://example.com/final" }),
  );
  emit("did-navigate-in-page", "https://example.com/final#section", true);
  expect(send).toHaveBeenLastCalledWith(
    "mediax:browser-navigation-changed",
    "web-test",
    expect.objectContaining({ url: "https://example.com/final#section" }),
  );
  emit("page-favicon-updated", ["https://mp.toutiao.com/favicon.ico"]);
  await vi.waitFor(() =>
    expect(send).toHaveBeenLastCalledWith(
      "mediax:browser-navigation-changed",
      "web-test",
      expect.objectContaining({ icon: "data:image/png;base64,aWNvbg==" }),
    ),
  );
  expect(loadFavicon).toHaveBeenCalled();
  expect(browsers.favicon("web-test")).toBe("data:image/png;base64,aWNvbg==");
  emit("did-start-navigation", "https://example.com/next", false, true);
  expect(browsers.favicon("web-test")).toBeUndefined();
  state.loading = true;
  emit("did-start-loading");
  expect(send).toHaveBeenLastCalledWith(
    "mediax:browser-navigation-changed",
    "web-test",
    expect.objectContaining({ loading: true }),
  );
  state.loading = false;
  emit("did-stop-loading");
  expect(send).toHaveBeenLastCalledWith(
    "mediax:browser-navigation-changed",
    "web-test",
    expect.objectContaining({ loading: false }),
  );
  finish();
  await opening;
});

it("reports native page focus and clicks even without a history popup", async () => {
  const browsers = manager();
  const interaction = vi.fn();
  browsers.setPageInteraction(interaction);
  view.webContents.loadURL.mockResolvedValueOnce(undefined);
  await browsers.open("web-page", "https://example.com/", { focus: false });
  const emit = (name: string, ...args: unknown[]) => {
    for (const [event, listener] of view.webContents.on.mock.calls) {
      if (event === name) listener({}, ...args);
    }
  };
  emit("focus");
  expect(interaction).toHaveBeenCalledOnce();
  emit("input-event", { type: "mouseDown" });
  expect(interaction).toHaveBeenCalledTimes(2);
  emit("input-event", { type: "mouseMove" });
  expect(interaction).toHaveBeenCalledTimes(2);
});

it("ignores older favicon requests even when navigation returns to the same URL", async () => {
  const browsers = manager();
  view.webContents.loadURL.mockResolvedValueOnce(undefined);
  await browsers.open("account-1", "https://mp.toutiao.com/", { focus: false });
  const emit = (name: string, ...args: unknown[]) => {
    for (const [event, listener] of view.webContents.on.mock.calls) {
      if (event === name) listener({}, ...args);
    }
  };
  let finishOld!: (icon: string) => void;
  vi.mocked(loadFavicon).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  emit("page-favicon-updated", ["https://example.com/old.ico"]);
  emit("did-start-navigation", "https://mp.toutiao.com/", false, true);
  emit("page-favicon-updated", ["https://example.com/new.ico"]);
  await vi.waitFor(() =>
    expect(browsers.favicon("account-1")).toBe("data:image/png;base64,aWNvbg=="),
  );
  finishOld("data:image/png;base64,b2xk");
  await Promise.resolve();
  expect(browsers.favicon("account-1")).toBe("data:image/png;base64,aWNvbg==");
});
