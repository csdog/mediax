import { expect, it, vi } from "vitest";
import type { Locator, Page } from "playwright-core";
import { openKindEditor } from "../../../../src/main/platforms/editor";
import { replaceRichText } from "../../../../src/main/platforms/form";
import type { Task } from "../../../../src/shared/models";

const article: Task = {
  id: "t1",
  contentKind: "article",
  title: "专栏标题",
  body: "# Hello\n\n**world**",
  images: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

it("fills Zhihu article bodies with the rich-text callback instead of plain text", async () => {
  const fillArticleBody = vi.fn();
  const body = {
    first: () => body,
    waitFor: vi.fn(),
  };
  const missing = {
    first: () => ({ count: async () => 0 }),
  };
  const page = {
    goto: vi.fn(),
    url: () => "https://zhuanlan.zhihu.com/write",
    locator: vi.fn((selector: string) => (selector.includes("contenteditable") ? body : missing)),
  } as unknown as Page;
  await openKindEditor(page, article, {
    url: "https://zhuanlan.zhihu.com/write",
    loggedOut: () => false,
    hint: "请先在账号浏览器中登录 知乎",
    files: "none",
    fillArticleBody,
  });
  expect(fillArticleBody).toHaveBeenCalledWith(page, body, article.body);
});

it("pastes HTML into the editor and falls back to plain text when paste does not stick", async () => {
  const evaluate = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const press = vi.fn();
  const insertText = vi.fn();
  const box = {
    waitFor: vi.fn(),
    click: vi.fn(),
    evaluate,
  } as unknown as Locator;
  const page = { keyboard: { press, insertText } } as unknown as Page;
  await replaceRichText(page, box, "<h1>Hello</h1>", "Hello");
  expect(evaluate).toHaveBeenCalledWith(expect.any(Function), {
    html: "<h1>Hello</h1>",
    plain: "Hello",
  });
  expect(insertText).not.toHaveBeenCalled();
  await replaceRichText(page, box, "<h1>Hello</h1>", "Hello");
  expect(insertText).toHaveBeenCalledWith("Hello");
});
