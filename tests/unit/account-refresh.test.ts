import { expect, it, vi } from "vitest";
import { AccountService } from "../../src/main/accounts/AccountService";
import { Database } from "../../src/main/storage/Database";
import type { AccountBrowserManager } from "../../src/main/browser/AccountBrowserManager";

it("opens a closed account in the background before inspecting its current login state", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("待检查账号", "facebook");
    const view = {
      webContents: {
        isDestroyed: () => false,
        getURL: () => "https://www.facebook.com/login",
        session: { cookies: { get: vi.fn().mockResolvedValue([]) } },
      },
    };
    let opened = false;
    const browsers = {
      get: vi.fn(() => (opened ? view : undefined)),
      open: vi.fn(async () => {
        opened = true;
        return view;
      }),
      show: vi.fn(),
    };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    const result = await service.refresh(account.id);
    expect(browsers.open).toHaveBeenCalledWith(account.id, expect.any(String), {
      platform: "facebook",
      focus: false,
    });
    expect(browsers.show).not.toHaveBeenCalled();
    expect(result.login).toBe("logged_out");
    expect(view.webContents.session.cookies.get).toHaveBeenCalled();
    expect(service.list()[0].login).toBe("logged_out");
  } finally {
    db.close();
  }
});

it("does not replace an already open account page when refreshing", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("已打开账号", "facebook");
    const browsers = {
      get: () => ({
        webContents: {
          isDestroyed: () => false,
          getURL: () => "https://www.facebook.com/login",
          session: { cookies: { get: vi.fn().mockResolvedValue([]) } },
        },
      }),
      open: vi.fn(),
    };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    await service.refresh(account.id);
    expect(browsers.open).not.toHaveBeenCalled();
  } finally {
    db.close();
  }
});

it("reports a stalled background page load and releases the account operation", async () => {
  vi.useFakeTimers();
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("加载缓慢账号", "facebook");
    const browsers = { get: () => undefined, open: () => new Promise(() => {}) };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    const checking = expect(service.refresh(account.id)).rejects.toThrow("账号页面加载超时");
    await vi.advanceTimersByTimeAsync(15_000);
    await checking;
    await expect(service.exclusive(async () => "available")).resolves.toBe("available");
  } finally {
    db.close();
    vi.useRealTimers();
  }
});
