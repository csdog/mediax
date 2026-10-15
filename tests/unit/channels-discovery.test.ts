import { expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { ChannelsAdapter } from "../../src/main/platforms/channels/ChannelsAdapter";

it.each([
  "https://open.weixin.qq.com/connect/qrconnect",
  "https://open.weixin.qq.com/connect/confirm",
  "https://channels.weixin.qq.com/login.html",
  "https://channels.weixin.qq.com/auth/callback?code=test",
  "https://channels.weixin.qq.com/",
])("does not interrupt the login handoff at %s", async (url) => {
  const page = { url: () => url, goto: vi.fn() };
  const adapter = new ChannelsAdapter(async () => page as unknown as Page);
  expect(await adapter.discover("account-1")).toEqual([]);
  expect(page.goto).not.toHaveBeenCalled();
});

it("discovers a Channels identity once the platform workspace has loaded", async () => {
  const page = { url: () => "https://channels.weixin.qq.com/platform", goto: vi.fn() };
  const adapter = new ChannelsAdapter(async () => page as unknown as Page);
  expect(await adapter.discover("account-1")).toEqual([
    { accountId: "account-1", identityId: "1", name: "视频号", kind: "profile" },
  ]);
  expect(page.goto).not.toHaveBeenCalled();
});
