// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readWeiboProfile } from "../../../../src/main/platforms/weibo/weiboProfile";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

it("reads the logged-in nickname from the Weibo page store", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector("#app") as HTMLElement & {
    __vue_app__?: unknown;
  };
  app.__vue_app__ = {
    config: {
      globalProperties: {
        $store: {
          state: {
            config: {
              config: { uid: "100", user: { id: 100, screen_name: "小明" } },
            },
          },
        },
      },
    },
  };
  expect(await readWeiboProfile()).toEqual({ name: "小明", id: "100", href: null });
});

it("loads the nickname from the profile API when the page store has no user", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/ajax/config/get_config"))
        return { ok: true, json: async () => ({ ok: 1, data: { uid: "42" } }) };
      if (url.includes("/ajax/profile/info?uid=42"))
        return {
          ok: true,
          json: async () => ({ ok: 1, data: { user: { idstr: "42", screen_name: "阿花" } } }),
        };
      return { ok: false, json: async () => null };
    }),
  );
  expect(await readWeiboProfile()).toEqual({ name: "阿花", id: "42", href: null });
});

it("ignores the generic platform label", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, json: async () => null })),
  );
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.querySelector("#app") as HTMLElement & { __vue_app__?: unknown };
  app.__vue_app__ = {
    config: {
      globalProperties: {
        $store: {
          state: {
            config: {
              config: { user: { id: 1, screen_name: "新浪微博" } },
            },
          },
        },
      },
    },
  };
  expect(await readWeiboProfile()).toBeNull();
});

it("keeps the avatar tied to the signed-in uid when using a partition request", async () => {
  const request = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith("get_config")
        ? { data: { uid: "42" } }
        : {
            data: {
              user: { idstr: "42", screen_name: "本人", avatar_large: "//images.example/self.jpg" },
            },
          },
  }));
  expect(await readWeiboProfile(request)).toEqual({
    name: "本人",
    id: "42",
    href: "https://images.example/self.jpg",
  });
});
