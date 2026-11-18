import { expect, it } from "vitest";
import { findDeepLinkArg, parseDeepLink } from "../../src/main/desktop/deepLinks";
import { productProtocol } from "../../src/shared/product";

const deepLink = (path: string) => `${productProtocol}://${path}`;

it("parses mediax deep links into desktop commands", () => {
  expect(parseDeepLink(deepLink("publish"))).toEqual({
    action: "navigate",
    page: "publish",
    taskId: undefined,
  });
  expect(parseDeepLink(deepLink("compose"))).toBeNull();
  expect(parseDeepLink(deepLink("video"))).toBeNull();
  expect(parseDeepLink(deepLink("accounts/"))).toEqual({
    action: "navigate",
    page: "accounts",
    taskId: undefined,
  });
  expect(parseDeepLink(deepLink("history/task-1"))).toEqual({
    action: "navigate",
    page: "history",
    taskId: "task-1",
  });
  expect(parseDeepLink(deepLink("history?taskId=abc"))).toEqual({
    action: "navigate",
    page: "history",
    taskId: "abc",
  });
  expect(parseDeepLink(deepLink("settings"))).toEqual({ action: "settings" });
  expect(parseDeepLink(deepLink("calendar"))).toEqual({
    action: "navigate",
    page: "calendar",
    taskId: undefined,
  });
  expect(parseDeepLink(deepLink("analytics"))).toEqual({
    action: "navigate",
    page: "analytics",
    taskId: undefined,
  });
  expect(parseDeepLink("https://example.com")).toBeNull();
  expect(parseDeepLink(deepLink("unknown"))).toBeNull();
});

it("finds a deep link among process argv", () => {
  expect(findDeepLinkArg(["/app", deepLink("publish"), "--flag"])).toBe(deepLink("publish"));
  expect(findDeepLinkArg(["/app", "--flag"])).toBeUndefined();
});
