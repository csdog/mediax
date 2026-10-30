// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DemoIndexPage } from "../../../src/renderer/demos/DemoIndexPage";

afterEach(cleanup);
it("lists the existing toast demo and links to its standalone page", () => {
  window.desktop = {} as typeof window.desktop;
  render(<DemoIndexPage />);
  expect(screen.getByRole("heading", { name: "Demo 导航" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Toast 通知/ }).getAttribute("href")).toBe(
    "./toast/index.html",
  );
  expect(screen.getByRole("button", { name: "返回工作区" })).toBeTruthy();
});
