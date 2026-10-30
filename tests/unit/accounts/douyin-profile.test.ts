import { afterEach, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { readDouyinProfile } from "../../../src/main/accounts/douyinProfile";
import { DouyinAdapter } from "../../../src/main/platforms/douyin/DouyinAdapter";
import { platformHome } from "../../../src/main/platforms/catalog";

afterEach(() => vi.unstubAllGlobals());
const profile = {
  status_code: 0,
  uid: "123",
  user_profile: { nick_name: "观察世界", avatar_url: "//p3.douyinpic.com/avatar.jpg" },
};

it("reads and serializes the current creator account profile", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify(profile)));
  expect(await readDouyinProfile(request)).toEqual({
    name: "观察世界",
    href: "https://p3.douyinpic.com/avatar.jpg",
  });
  expect(request).toHaveBeenCalledWith("https://creator.douyin.com/aweme/v1/creator/pc/user/info/");
  vi.stubGlobal("fetch", request);
  const serialized = new Function(`return (${readDouyinProfile.toString()})`)();
  expect(await serialized()).toEqual(await readDouyinProfile(request));
  expect(request).toHaveBeenCalledWith(expect.any(String), { credentials: "include" });
});

it.each([
  null,
  { status_code: 8, user_profile: profile.user_profile },
  { status_code: 4 },
  { status_code: 0, user_profile: { nick_name: " " } },
  { status_code: 0, user_profile: { nick_name: 12 } },
])("rejects logged-out or malformed profiles: %j", async (payload) => {
  expect(await readDouyinProfile(async () => new Response(JSON.stringify(payload)))).toBeNull();
});

it("falls back to the second creator endpoint and rejects unsafe avatar URLs", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status_code: 0,
          user_profile: { nick_name: "观察世界", avatar_url: "javascript:alert(1)" },
        }),
      ),
    );
  expect(await readDouyinProfile(request)).toEqual({ name: "观察世界", href: null });
  expect(request).toHaveBeenLastCalledWith(
    "https://creator.douyin.com/aweme/v1/creator/user/info/",
  );
});

it("opens the creator home and discovers the real publishing identity", async () => {
  expect(platformHome.douyin).toBe("https://creator.douyin.com/creator-micro/home");
  const page = {
    url: () => platformHome.douyin,
    evaluate: vi.fn(async () => ({ name: "观察世界", href: null })),
  } as unknown as Page;
  expect(await new DouyinAdapter(async () => page).discover("account")).toEqual([
    { accountId: "account", identityId: "1", name: "观察世界", kind: "profile" },
  ]);
});
