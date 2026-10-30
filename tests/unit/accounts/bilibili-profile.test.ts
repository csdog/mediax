import { afterEach, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { readBilibiliProfile } from "../../../src/main/accounts/bilibiliProfile";
import { BilibiliAdapter } from "../../../src/main/platforms/bilibili/BilibiliAdapter";
import { platformHome } from "../../../src/main/platforms/catalog";

afterEach(() => vi.unstubAllGlobals());

it("reads the signed-in account instead of a video author or generic avatar", async () => {
  const request = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            isLogin: true,
            uname: "真实账号",
            face: "//i0.hdslb.com/bfs/face/self.jpg",
            mid: 123,
          },
        }),
      ),
  );
  expect(await readBilibiliProfile(request)).toEqual({
    name: "真实账号",
    href: "https://i0.hdslb.com/bfs/face/self.jpg",
  });
  expect(request).toHaveBeenCalledWith("https://api.bilibili.com/x/web-interface/nav");
  vi.stubGlobal("fetch", request);
  const serialized = new Function(`return (${readBilibiliProfile.toString()})`)();
  expect(await serialized()).toEqual(await readBilibiliProfile(request));
  expect(request).toHaveBeenCalledWith(expect.any(String), { credentials: "include" });
});

it.each([
  { code: -101, data: { isLogin: false } },
  { code: 0, data: { isLogin: false, uname: "游客" } },
  { code: 0, data: { isLogin: true, uname: " " } },
  { code: 0, data: { isLogin: true, uname: 123 } },
  null,
])("does not adopt missing or logged-out account data: %j", async (payload) => {
  expect(await readBilibiliProfile(async () => new Response(JSON.stringify(payload)))).toBeNull();
});

it("keeps the profile name without an avatar and handles unavailable requests", async () => {
  expect(
    await readBilibiliProfile(
      async () =>
        new Response(
          JSON.stringify({
            code: 0,
            data: { isLogin: true, uname: "真实账号" },
          }),
        ),
    ),
  ).toEqual({ name: "真实账号", href: null });
  expect(
    await readBilibiliProfile(async () => {
      throw new Error("offline");
    }),
  ).toBeNull();
});

it("opens the creator center and discovers the actual Bilibili publishing identity", async () => {
  expect(platformHome.bilibili).toBe("https://member.bilibili.com/platform/home");
  const page = {
    url: () => platformHome.bilibili,
    evaluate: vi.fn(async () => ({ name: "真实账号", href: null })),
  } as unknown as Page;
  expect(await new BilibiliAdapter(async () => page).discover("account")).toEqual([
    { accountId: "account", identityId: "1", name: "真实账号", kind: "profile" },
  ]);
});
