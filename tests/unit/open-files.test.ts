import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findOpenFileArgs, openFilesCommand } from "../../src/main/desktop/openFiles";
import { preferredPageForFiles } from "../../src/shared/content";

describe("open files", () => {
  it("picks openable paths from argv and ignores flags / deep links", () => {
    const dir = mkdtempSync(join(tmpdir(), "mediax-open-"));
    const md = join(dir, "note.md");
    const png = join(dir, "cover.png");
    writeFileSync(md, "# hi");
    writeFileSync(png, "x");
    expect(
      findOpenFileArgs([
        "/app/Electron",
        "--some-flag",
        "mediax://publish",
        md,
        png,
        join(dir, "missing.md"),
      ]),
    ).toEqual([md, png]);
    expect(openFilesCommand([md, png, md])).toEqual({
      action: "open-files",
      paths: [md, png],
    });
  });

  it("routes video files to the video page", () => {
    expect(preferredPageForFiles(["/tmp/a.md", "/tmp/b.png"])).toBe("compose");
    expect(preferredPageForFiles(["/tmp/clip.mp4"])).toBe("video");
  });
});
