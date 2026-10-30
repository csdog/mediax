import { expect, it, vi } from "vitest";
import { AccountService } from "../../../src/main/accounts/AccountService";
import { Database } from "../../../src/main/storage/Database";
import type { AccountBrowserManager } from "../../../src/main/browser/AccountBrowserManager";
import type { Page } from "playwright-core";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  session: {},
  nativeImage: {
    createFromBuffer: () => ({
      isEmpty: () => false,
      resize: () => ({ toDataURL: () => "data:image/png;base64,c2VsZg==" }),
    }),
  },
}));

it("updates Zhihu name/avatar and persisted identities together, without reviving stale names", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("旧账号名", "zhihu");
    const targets = [{ accountId: account.id, identityId: "1", name: "旧账号名", kind: "profile" }];
    db.setSetting(`identities:${account.id}`, { owner: "zhihu", targets });
    db.setSetting(`account-status:${account.id}`, { login: "logged_in", targets });
    const fetch = vi.fn(async (url: string) =>
      url.includes("/api/v4/me")
        ? new Response(
            JSON.stringify({
              id: "self-id",
              name: "当前账号",
              avatar_url: "https://picx.zhimg.com/self.png",
            }),
          )
        : new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }),
    );
    const executeJavaScript = vi.fn();
    const view = {
      webContents: {
        isDestroyed: () => false,
        getURL: () => "https://www.zhihu.com/creator",
        isLoadingMainFrame: () => false,
        session: { cookies: { get: async () => [{ name: "z_c0", value: "session" }] }, fetch },
        executeJavaScript,
      },
    };
    const browsers = { get: () => view, open: async () => view, show: vi.fn() };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    await service.open(account.id);
    expect(service.list()[0]).toMatchObject({
      name: "当前账号",
      avatar: "data:image/png;base64,c2VsZg==",
      targets: [{ name: "当前账号" }],
    });
    expect(
      new AccountService(db, browsers as unknown as AccountBrowserManager).list()[0],
    ).toMatchObject({ name: "当前账号", targets: [{ name: "当前账号" }] });
    expect(executeJavaScript).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "https://www.zhihu.com/api/v4/me",
      expect.objectContaining({ credentials: "include" }),
    );
  } finally {
    db.close();
  }
});

it("does not call a public landing page logged in or manufacture a platform-name identity", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("搜狐号 账号 1", "sohu");
    const view = {
      webContents: {
        isDestroyed: () => false,
        getURL: () => "https://mp.sohu.com/",
        isLoadingMainFrame: () => false,
        session: { cookies: { get: async () => [] } },
        executeJavaScript: vi.fn(async () => null),
      },
    };
    const browsers = { get: () => view, open: async () => view, show: vi.fn() };
    const service = new AccountService(db, browsers as unknown as AccountBrowserManager);
    await service.open(account.id);
    expect(service.list()[0]).toMatchObject({ login: "logged_out", targets: [] });
  } finally {
    db.close();
  }
});

it("does not expose old generic-avatar caches as verified account portraits", () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("账号", "zhihu");
    db.setSetting(`avatar:${account.id}`, {
      owner: "zhihu",
      actor: "zhihu",
      image: "data:image/png;base64,b3RoZXI=",
    });
    expect(new AccountService(db, {} as AccountBrowserManager).list()[0].avatar).toBeUndefined();
  } finally {
    db.close();
  }
});

it("does not keep a legacy platform-label publishing identity as a real account", () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("抖音 账号 1", "douyin");
    db.setSetting(`identities:${account.id}`, {
      owner: "douyin",
      targets: [{ accountId: account.id, identityId: "1", name: "抖音账号", kind: "profile" }],
    });
    expect(new AccountService(db, {} as AccountBrowserManager).list()[0].targets).toEqual([]);
  } finally {
    db.close();
  }
});

it("clears a previous single-profile identity when the current page cannot discover one", async () => {
  const db = new Database(":memory:");
  try {
    const account = db.addAccount("以前的用户", "zhihu");
    const targets = [
      { accountId: account.id, identityId: "1", name: "以前的用户", kind: "profile" },
    ];
    db.setSetting(`identities:${account.id}`, { owner: "zhihu", targets });
    db.setSetting(`account-status:${account.id}`, { login: "logged_in", targets });
    const view = {
      webContents: {
        isDestroyed: () => false,
        getURL: () => "https://www.zhihu.com/creator",
        isLoadingMainFrame: () => false,
        session: {
          cookies: { get: async () => [{ name: "z_c0", value: "session" }] },
          fetch: async () => new Response("{}", { status: 401 }),
        },
        executeJavaScript: async () => null,
      },
    };
    const page = {
      url: () => "https://www.zhihu.com/creator",
      evaluate: async () => null,
      waitForFunction: async () => {},
    } as unknown as Page;
    const browsers = { get: () => view, page: async () => page };
    const result = await new AccountService(
      db,
      browsers as unknown as AccountBrowserManager,
    ).refresh(account.id);
    expect(result.targets).toEqual([]);
    expect(result.message).toContain("没有读到账号");
  } finally {
    db.close();
  }
});
