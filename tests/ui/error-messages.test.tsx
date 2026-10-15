// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppErrorView } from "../../src/renderer/components/AppErrorView";

afterEach(cleanup);

it("keeps implementation details out of the error page even in development", () => {
  const error = new TypeError("Cannot read properties of undefined (reading 'webContents')");
  error.stack = "TypeError: secret detail\n    at /Users/user/source.ts:12:3";
  render(<AppErrorView error={error} />);
  expect(screen.getByRole("alert").textContent).toContain("操作未完成，请稍后重试。");
  expect(screen.getByRole("alert").textContent).not.toMatch(
    /TypeError|webContents|source\.ts|secret|开发信息/,
  );
});

it("shows the useful account instruction without the IPC wrapper", () => {
  render(
    <AppErrorView
      error={
        new Error(
          "Error invoking remote method 'mediax:refreshAccount': Error: 请在账号标签页中登录 头条号",
        )
      }
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("请在账号标签页中登录 头条号");
  expect(screen.getByRole("alert").textContent).not.toMatch(/mediax:|Error|remote method/);
});
