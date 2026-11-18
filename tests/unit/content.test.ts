import { it, expect } from "vitest";
import { markdownToHtml, markdownToText } from "../../src/main/content/markdown";
it("preserves meaningful text and links without executing HTML", () => {
  const out = markdownToText(
    "# Title\n\n- First\n- [Docs](https://example.com)\n\n<script>alert(1)</script>",
  );
  expect(out).toContain("Title");
  expect(out).toContain("First");
  expect(out).toContain("https://example.com");
  expect(out).not.toContain("<script>");
});

it("renders markdown to HTML for rich editors without raw HTML blocks", () => {
  const out = markdownToHtml(
    "# Title\n\nHello **world** and [Docs](https://example.com)\n\n- First\n\n```\ncode\n```\n\n<script>alert(1)</script>\n\n![x](javascript:alert(1))",
  );
  expect(out).toContain("<h1>Title</h1>");
  expect(out).toContain("<strong>world</strong>");
  expect(out).toContain('<a href="https://example.com">Docs</a>');
  expect(out).toContain("<li>");
  expect(out).toContain("<pre><code>code</code></pre>");
  expect(out).not.toContain("<script>");
  expect(out).not.toContain("javascript:");
  expect(out).not.toContain("<img");
});
