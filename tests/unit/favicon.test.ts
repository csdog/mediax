import { expect, it, vi } from "vitest";
import type { Session } from "electron";
vi.mock("electron", () => ({ nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) } }));
import { loadFavicon } from "../../src/main/browser/favicon";

it("preserves ICO icons that nativeImage cannot decode", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(new Uint8Array([0, 0, 1, 0]), { headers: { "content-type": "image/x-icon" } }),
  );
  const icon = await loadFavicon({ fetch } as unknown as Session, [
    "https://example.com/favicon.ico",
  ]);
  expect(icon).toBe("data:image/x-icon;base64,AAABAA==");
});
it("preserves URL-encoded SVG icons", async () => {
  const icon =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";
  expect(await loadFavicon({} as Session, [icon])).toBe(icon);
});
