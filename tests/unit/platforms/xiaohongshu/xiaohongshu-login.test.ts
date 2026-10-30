import { expect, it, vi } from "vitest";
import { AccountService } from "../../../../src/main/accounts/AccountService";
import { Database } from "../../../../src/main/storage/Database";
import type { AccountBrowserManager } from "../../../../src/main/browser/AccountBrowserManager";
import {
  hasPlatformSession,
  platformHome,
  sessionOwner,
} from "../../../../src/main/platforms/catalog";

const cookies = vi.hoisted(() => [{ name: "customer-sso-sid", value: "expired-session" }]);
vi.mock("electron", () => ({
  session: { fromPartition: () => ({ cookies: { get: async () => cookies } }) },
}));

it("does not treat stale cookies on the creator login page as an authenticated session", () => {
  expect(platformHome.xiaohongshu).toBe("https://creator.xiaohongshu.com/");
  for (const path of ["/login", "/login?redirect=/publish/publish", "/login.html", "/signin/"]) {
    const url = `https://creator.xiaohongshu.com${path}`;
    expect(hasPlatformSession("xiaohongshu", cookies, url)).toBe(false);
    expect(sessionOwner("xiaohongshu", cookies, url)).toBeNull();
  }
  expect(
    hasPlatformSession(
      "xiaohongshu",
      cookies,
      "https://creator.xiaohongshu.com/publish/publish?redirect=/login",
    ),
  ).toBe(true);
});

it("corrects a cached login on open and keeps it corrected after closing, restarting and background refresh", async () => {
  vi.useFakeTimers();
  const db = new Database(":memory:");
  let restored: AccountService | undefined;
  try {
    const account = db.addAccount("小红书账号", "xiaohongshu");
    db.setSetting(`account-status:${account.id}`, { login: "logged_in", targets: [] });
    let closed = false;
    const view = {
      webContents: {
        isDestroyed: () => false,
        isLoadingMainFrame: () => false,
        getURL: () => "https://creator.xiaohongshu.com/login",
        session: { cookies: { get: async () => cookies } },
      },
    };
    const browsers = {
      get: () => (closed ? undefined : view),
      open: vi.fn(async () => view),
      show: vi.fn(),
    };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    expect(service.list()[0]!.login).toBe("logged_in");
    expect((await service.listCurrent())[0]!.login).toBe("logged_out");
    await service.open(account.id);
    expect(browsers.open).toHaveBeenCalledWith(account.id, "https://creator.xiaohongshu.com/", {
      platform: "xiaohongshu",
    });
    expect(service.list()[0]!.login).toBe("logged_out");
    expect((await service.refresh(account.id)).login).toBe("logged_out");
    closed = true;
    restored = new AccountService(db, browsers as unknown as AccountBrowserManager);
    restored.startAutoRefresh();
    await vi.advanceTimersByTimeAsync(22_000);
    expect(restored.list()[0]!.login).toBe("logged_out");
  } finally {
    restored?.stopAutoRefresh();
    db.close();
    vi.useRealTimers();
  }
});

it("preserves status during navigation and recognizes a completed login from the creator workspace", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("小红书账号", "xiaohongshu");
    db.setSetting(`account-status:${account.id}`, { login: "logged_out", targets: [] });
    let loading = true;
    const getCookies = vi.fn(async () => cookies);
    const view = {
      webContents: {
        isDestroyed: () => false,
        isLoadingMainFrame: () => loading,
        getURL: () => "https://creator.xiaohongshu.com/",
        session: { cookies: { get: getCookies } },
        executeJavaScript: vi.fn(async () => null),
      },
    };
    const service = new AccountService(db, { get: () => view } as unknown as AccountBrowserManager);
    expect((await service.refresh(account.id)).login).toBe("logged_out");
    expect(getCookies).not.toHaveBeenCalled();
    vi.spyOn(service, "adapter").mockReturnValue({
      discover: async () => [],
    } as unknown as ReturnType<AccountService["adapter"]>);
    loading = false;
    expect((await service.refresh(account.id)).login).toBe("logged_in");
    expect(service.list()[0]!.login).toBe("logged_in");
  } finally {
    db.close();
  }
});
