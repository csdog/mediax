import { expect, it, vi } from "vitest";
import { AccountService } from "../../src/main/accounts/AccountService";
import { Database } from "../../src/main/storage/Database";
import type { AccountBrowserManager } from "../../src/main/browser/AccountBrowserManager";

const cookies = vi.hoisted(() => [
  { name: "sessionid", value: "stale-session" },
  { name: "wxuin", value: "user-id" },
]);
vi.mock("electron", () => ({
  session: { fromPartition: () => ({ cookies: { get: async () => cookies } }) },
}));

it("corrects stored Channels login status on open and does not restore it from stale cookies after closing", async () => {
  vi.useFakeTimers();
  const db = new Database(":memory:");
  let service: AccountService | undefined;
  try {
    const account = db.addAccount("视频号账号", "channels");
    db.setSetting(`account-status:${account.id}`, { login: "logged_in", targets: [] });
    let closed = false;
    const view = {
      webContents: {
        isDestroyed: () => false,
        isLoadingMainFrame: () => false,
        getURL: () => "https://channels.weixin.qq.com/login.html",
        session: { cookies: { get: async () => cookies } },
      },
    };
    const browsers = {
      get: () => (closed ? undefined : view),
      open: vi.fn(async () => view),
      show: vi.fn(),
    };
    service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    expect(service.list()[0].login).toBe("logged_in");
    await service.open(account.id);
    expect(service.list()[0].login).toBe("logged_out");
    expect((await service.refresh(account.id)).login).toBe("logged_out");
    closed = true;
    service.startAutoRefresh();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(service.list()[0].login).toBe("logged_out");
  } finally {
    service?.stopAutoRefresh();
    db.close();
    vi.useRealTimers();
  }
});

it("leaves the account unchanged while its QR callback is still navigating", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("扫码中账号", "channels");
    db.setSetting(`account-status:${account.id}`, { login: "logged_out", targets: [] });
    const getCookies = vi.fn();
    const browsers = {
      get: () => ({
        webContents: {
          isDestroyed: () => false,
          isLoadingMainFrame: () => true,
          session: { cookies: { get: getCookies } },
        },
      }),
    };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    expect((await service.refresh(account.id)).login).toBe("logged_out");
    expect(getCookies).not.toHaveBeenCalled();
  } finally {
    db.close();
  }
});

it("checks the Channels workspace and persists its login across closing and service recreation", async () => {
  vi.useFakeTimers();
  const db = new Database(":memory:");
  let restored: AccountService | undefined;
  try {
    const account = db.addAccount("视频号账号", "channels");
    db.setSetting(`account-status:${account.id}`, { login: "logged_in", targets: [] });
    let url = "";
    let opened = false;
    const view = {
      webContents: {
        isDestroyed: () => false,
        isLoadingMainFrame: () => false,
        getURL: () => url,
        session: { cookies: { get: async () => cookies } },
      },
    };
    const browsers = {
      get: () => (opened ? view : undefined),
      open: vi.fn(async (_id: string, target: string) => {
        url = target;
        opened = true;
        return view;
      }),
    };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    vi.spyOn(service, "adapter").mockReturnValue({ discover: async () => [] } as ReturnType<
      AccountService["adapter"]
    >);
    expect((await service.refresh(account.id)).login).toBe("logged_in");
    expect(browsers.open).toHaveBeenCalledWith(
      account.id,
      "https://channels.weixin.qq.com/platform",
      {
        platform: "channels",
        focus: false,
        waitUntil: "dom-ready",
      },
    );
    opened = false;
    restored = new AccountService(db, browsers as unknown as AccountBrowserManager);
    expect(restored.list()[0].login).toBe("logged_in");
    restored.startAutoRefresh();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(restored.list()[0].login).toBe("logged_in");
    expect((db.setting(`account-status:${account.id}`) as { login: string }).login).toBe(
      "logged_in",
    );
  } finally {
    restored?.stopAutoRefresh();
    db.close();
    vi.useRealTimers();
  }
});
