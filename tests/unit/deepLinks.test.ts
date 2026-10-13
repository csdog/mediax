import { expect, it } from "vitest";
import { findDeepLinkArg, parseDeepLink } from "../../src/main/desktop/deepLinks";

it("parses media-post deep links into desktop commands", () => {
  expect(parseDeepLink("media-post://compose")).toEqual({
    action: "navigate",
    page: "compose",
    taskId: undefined,
  });
  expect(parseDeepLink("media-post://accounts/")).toEqual({
    action: "navigate",
    page: "accounts",
    taskId: undefined,
  });
  expect(parseDeepLink("media-post://history/task-1")).toEqual({
    action: "navigate",
    page: "history",
    taskId: "task-1",
  });
  expect(parseDeepLink("media-post://history?taskId=abc")).toEqual({
    action: "navigate",
    page: "history",
    taskId: "abc",
  });
  expect(parseDeepLink("media-post://settings")).toEqual({ action: "settings" });
  expect(parseDeepLink("https://example.com")).toBeNull();
  expect(parseDeepLink("media-post://unknown")).toBeNull();
});

it("finds a deep link among process argv", () => {
  expect(findDeepLinkArg(["/app", "media-post://video", "--flag"])).toBe("media-post://video");
  expect(findDeepLinkArg(["/app", "--flag"])).toBeUndefined();
});
