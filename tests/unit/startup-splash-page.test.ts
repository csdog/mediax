import { describe, expect, it } from "vitest";
import { startupSplashHtml } from "../../src/main/desktop/startupSplashPage";

describe("startupSplashHtml", () => {
  it("embeds the icon on a transparent surface", () => {
    const html = startupSplashHtml("file:///tmp/icon.png");
    expect(html).toContain('src="file:///tmp/icon.png"');
    expect(html).toContain("background: transparent");
  });
});
