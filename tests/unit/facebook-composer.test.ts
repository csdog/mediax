import { expect, it } from "vitest";
import { composerStillHasPost } from "../../src/main/platforms/facebook/FacebookAdapter";

const body = "测试正文甲\n\n测试正文乙";

it("accepts the settings preview when the composer textbox has been cleared", () => {
  const surface = `帖子设置\n帖子预览\n${body}\n帖子分享对象\n公开\n发帖`;
  expect(composerStillHasPost("", surface, body)).toBe(true);
  expect(composerStillHasPost(null, surface, body)).toBe(true);
});

it("accepts a preview that only changes blank lines", () => {
  expect(composerStillHasPost("", "帖子预览\n测试正文甲\n测试正文乙\n发帖", body)).toBe(true);
});

it("rejects a preview that no longer contains the post", () => {
  expect(composerStillHasPost("", "帖子设置\n帖子预览\n另一段内容\n发帖", body)).toBe(false);
  expect(composerStillHasPost("另一段内容", "另一段内容", body)).toBe(false);
});
