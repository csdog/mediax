import { describe, expect, it } from "vitest";
import {
  matchBrowserHistory,
  rememberVisit,
  removeHistoryEntry,
} from "../../src/main/browser/BrowserHistoryStore";

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

  it("stores the visiting account on each entry", () => {
    const first = rememberVisit(
      [],
      "https://example.com/a",
      "Example",
      10,
      true,
      undefined,
      "acct-1",
      "主账号",
    );
    expect(first[0]).toMatchObject({
      url: "https://example.com/a",
      accountId: "acct-1",
      accountLabel: "主账号",
    });
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

  it("removes a visit by url", () => {
    const entries = rememberVisit([], "https://example.com/a", "Example", 10, true);
    const next = removeHistoryEntry(entries, "https://example.com/a");
    expect(next).toEqual([]);
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

it("returns older history entries beyond the first eight for scrolling", () => {
  const entries = Array.from({ length: 30 }, (_, index) => ({
    url: `https://example.com/${index}`,
    title: `Page ${index}`,
    visitedAt: index,
  }));
  const matched = matchBrowserHistory(entries, "");
  expect(matched).toHaveLength(30);
  expect(matched[29].url).toBe("https://example.com/0");
});

it("clears a previous account badge when revisited without that session", () => {
  const entries = rememberVisit(
    [],
    "https://example.com",
    "Page",
    1,
    true,
    undefined,
    "acct-1",
    "Account",
  );
  const revisited = rememberVisit(entries, "https://example.com", "Page", 2, true);
  expect(revisited[0].accountId).toBeUndefined();
  expect(revisited[0].accountLabel).toBeUndefined();
});
