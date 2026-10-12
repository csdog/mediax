// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../../src/renderer/src";
it("imports Markdown, previews content, saves draft and disables unverified publishing", async () => {
  window.desktop = {
    accounts: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue({ tasks: [], targets: [] }),
    loadDraft: vi.fn().mockResolvedValue({ body: "", images: [] }),
    importMarkdown: vi.fn().mockResolvedValue("Imported article"),
    saveDraft: vi.fn().mockResolvedValue(undefined),
  } as any;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  render(<App />);
  await waitFor(() => expect(window.desktop.loadDraft).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "内容发布" }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "导入 Markdown",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "导入 Markdown" }));
  await waitFor(() =>
    expect((screen.getByLabelText("发布正文") as HTMLTextAreaElement).value).toBe(
      "Imported article",
    ),
  );
  expect(screen.getByText("Imported article", { selector: "p" })).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "发布",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() =>
    expect(window.desktop.saveDraft).toHaveBeenCalledWith("Imported article", []),
  );
});
