import { expect, it } from "vitest";
import { userErrorMessage } from "../../src/shared/userError";

it("unwraps nested IPC errors while preserving actionable instructions", () => {
  const hint = "账号页面加载超时，请打开账号浏览器确认网络后重试";
  expect(
    userErrorMessage(
      new Error(`Error invoking remote method 'mediax:refreshAccount': Error: ${hint}`),
    ),
  ).toBe(hint);
  expect(
    userErrorMessage(`Error: Error invoking remote method 'mediax:openAccount': Error: ${hint}`),
  ).toBe(hint);
  expect(userErrorMessage("请在账号标签页中登录 Google / YouTube")).toBe(
    "请在账号标签页中登录 Google / YouTube",
  );
});

it.each([
  "Cannot read properties of undefined (reading 'isDestroyed')",
  "身份检查失败：locator.waitFor: missing element",
  '解析失败：Unexpected token {"secret":"private"}',
  "打开失败：/Users/user/project/out/main/index.js:12:3",
  "未知错误：https://example.com/?token=private",
  { debug: "private" },
])("does not expose implementation details: %s", (error) => {
  expect(userErrorMessage(error, "暂时无法完成，请重试。")).toBe("暂时无法完成，请重试。");
});

it("explains network and file errors without codes or addresses", () => {
  expect(userErrorMessage("ERR_FAILED (-2) loading 'https://example.com/?token=private'")).toBe(
    "页面暂时无法连接，请检查网络后重试。",
  );
  expect(userErrorMessage("EACCES /Users/user/private.txt")).toBe(
    "没有访问权限，请检查文件或文件夹权限。",
  );
  expect(userErrorMessage("TimeoutError: locator.waitFor timed out")).toBe(
    "等待时间较长，请稍后重试。",
  );
  expect(userErrorMessage(new Error("请选择发布账号\n    at source.ts:3:2"))).toBe(
    "请选择发布账号",
  );
});
