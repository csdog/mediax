import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importLocalPaths, isMarkdownPath } from "../../src/main/content/mediaAssets";
import type { ImageAsset } from "../../src/shared/models";

describe("media assets import", () => {
  it("imports markdown text and image assets for the current kind", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mediax-media-"));
    const md = join(dir, "post.md");
    const png = join(dir, "cover.png");
    // Minimal 1x1 PNG
    writeFileSync(
      png,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    writeFileSync(md, "# Title\n\nHello **world**");
    expect(isMarkdownPath(md)).toBe(true);
    const cache = new Map<string, ImageAsset>();
    const result = await importLocalPaths([md, png, join(dir, "clip.mp4")], "moment", cache);
    expect(result.markdown).toContain("Hello");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.path).toBe(png);
    expect(result.warnings.some((item) => item.includes("不符"))).toBe(true);
    expect(cache.has(png)).toBe(true);
  });
});
