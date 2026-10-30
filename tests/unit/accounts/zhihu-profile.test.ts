import { expect, it, vi } from "vitest";
import { readZhihuProfile } from "../../../src/main/accounts/zhihuProfile";

it("reads the current signed-in Zhihu user, preserving names with spaces", async () => {
  const request = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: "self-id",
          name: "真实 账号",
          avatar_url: "https://picx.zhimg.com/self.jpg",
        }),
      ),
  );
  expect(await readZhihuProfile(request)).toEqual({
    name: "真实 账号",
    href: "https://picx.zhimg.com/self.jpg",
  });
  expect(request).toHaveBeenCalledWith("https://www.zhihu.com/api/v4/me");
});
it.each([
  null,
  {},
  { error: { message: "unauthenticated" } },
  { id: "", name: "游客" },
  { id: "self", name: 42 },
])("ignores unavailable or unauthenticated data: %j", async (payload) => {
  expect(await readZhihuProfile(async () => new Response(JSON.stringify(payload)))).toBeNull();
});
it("keeps the verified name when the avatar is missing or unsafe", async () => {
  expect(
    await readZhihuProfile(
      async () =>
        new Response(
          JSON.stringify({ id: "self", name: "真实账号", avatar_url: "javascript:alert(1)" }),
        ),
    ),
  ).toEqual({ name: "真实账号", href: null });
});
