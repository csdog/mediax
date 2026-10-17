import { describe, expect, it } from "vitest";
import { startupSplashHtml } from "../../src/main/desktop/startupSplashPage";

describe("startupSplashHtml", () => {
  it("embeds the icon and light background", () => {
    const html = startupSplashHtml("file:///tmp/icon.png", false);
    expect(html).toContain('src="file:///tmp/icon.png"');
    expect(html).toContain("#f9f9f9");
    expect(html).toContain('content="light"');
  });

  it("uses a dark background when requested", () => {
    const html = startupSplashHtml("file:///tmp/icon.png", true);
    expect(html).toContain("#000000");
    expect(html).toContain('content="dark"');
  });
});
