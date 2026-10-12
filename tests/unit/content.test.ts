import { it, expect } from "vitest";
import { markdownToText } from "../../src/main/content/markdown";
it("preserves meaningful text and links without executing HTML", () => {
  const out = markdownToText(
    "# Title\n\n- First\n- [Docs](https://example.com)\n\n<script>alert(1)</script>",
  );
  expect(out).toContain("Title");
  expect(out).toContain("First");
  expect(out).toContain("https://example.com");
  expect(out).not.toContain("<script>");
});
