import { describe, expect, it } from "vitest";
import { matchBrowserHistory, rememberVisit } from "../../src/main/browser/BrowserHistoryStore";

describe("browser history", () => {
  it("keeps http visits and ignores other schemes", () => {
    const first = rememberVisit([], "https://example.com/a", "Example", 10, true);
    const next = rememberVisit(first, "about:blank", "", 20, true);
    expect(next).toEqual([{ url: "https://example.com/a", title: "Example", visitedAt: 10 }]);
  });

  it("moves a revisited page to the front and updates its title without a new visit", () => {
    const first = rememberVisit([], "https://example.com/a", "Example", 10, true);
    const titled = rememberVisit(first, "https://example.com/a", "Updated", 30, false);
    const again = rememberVisit(titled, "https://example.com/a", "Updated", 40, true);
    expect(again[0]).toEqual({ url: "https://example.com/a", title: "Updated", visitedAt: 40 });
  });

  it("stores a site icon without counting it as a new visit", () => {
    const icon = "data:image/png;base64,abc";
    const first = rememberVisit([], "https://example.com/a", "Example", 10, true);
    const withIcon = rememberVisit(first, "https://example.com/a", "Example", 30, false, icon);
    const titled = rememberVisit(withIcon, "https://example.com/a", "Updated", 40, false);
    expect(withIcon[0]?.visitedAt).toBe(10);
    expect(titled[0]).toEqual({
      url: "https://example.com/a",
      title: "Updated",
      visitedAt: 10,
      icon,
    });
  });

  it("filters suggestions by title or url", () => {
    const entries = rememberVisit(
      rememberVisit([], "https://news.example/story", "Morning", 2, true),
      "https://docs.example/guide",
      "Guide",
      1,
      true,
    );
    expect(matchBrowserHistory(entries, "guide").map((entry) => entry.url)).toEqual([
      "https://docs.example/guide",
    ]);
    expect(matchBrowserHistory(entries, "").map((entry) => entry.url)).toEqual([
      "https://news.example/story",
      "https://docs.example/guide",
    ]);
  });
});
