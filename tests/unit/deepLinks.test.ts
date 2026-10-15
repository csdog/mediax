import { expect, it } from "vitest";
import { findDeepLinkArg, parseDeepLink } from "../../src/main/desktop/deepLinks";

it("parses mediax deep links into desktop commands", () => {
  expect(parseDeepLink("mediax://compose")).toEqual({
    action: "navigate",
    page: "compose",
    taskId: undefined,
  });
  expect(parseDeepLink("mediax://accounts/")).toEqual({
    action: "navigate",
    page: "accounts",
    taskId: undefined,
  });
  expect(parseDeepLink("mediax://history/task-1")).toEqual({
    action: "navigate",
    page: "history",
    taskId: "task-1",
  });
  expect(parseDeepLink("mediax://history?taskId=abc")).toEqual({
    action: "navigate",
    page: "history",
    taskId: "abc",
  });
  expect(parseDeepLink("mediax://settings")).toEqual({ action: "settings" });
  expect(parseDeepLink("mediax://calendar")).toEqual({
    action: "navigate",
    page: "calendar",
    taskId: undefined,
  });
  expect(parseDeepLink("mediax://analytics")).toEqual({
    action: "navigate",
    page: "analytics",
    taskId: undefined,
  });
  expect(parseDeepLink("https://example.com")).toBeNull();
  expect(parseDeepLink("mediax://unknown")).toBeNull();
});

it("finds a deep link among process argv", () => {
  expect(findDeepLinkArg(["/app", "mediax://video", "--flag"])).toBe("mediax://video");
  expect(findDeepLinkArg(["/app", "--flag"])).toBeUndefined();
});
