import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { submitKindEditor } from "../../src/main/platforms/editor";

describe("web editor submit", () => {
  function fixture(enabled: boolean) {
    const click = vi.fn(async (options?: { trial?: boolean }) => {
      if (options?.trial && !enabled) throw new Error("not actionable");
    });
    const page = {
      getByRole: (_role: string, options: { name: string }) => ({
        first: () => ({
          count: async () => (options.name === "发想法" ? 1 : 0),
          isVisible: async () => true,
          isEnabled: async () => enabled,
          click,
        }),
      }),
    } as unknown as Page;
    return { page, click, mark: vi.fn() };
  }
  it("recognizes Zhihu 发想法 and records submission intent before clicking", async () => {
    const { page, click, mark } = fixture(true);
    await submitKindEditor(page, mark);
    expect(click).toHaveBeenCalledTimes(2);
    expect(click.mock.calls[0][0]).toMatchObject({ trial: true });
    expect(mark.mock.invocationCallOrder[0]).toBeLessThan(click.mock.invocationCallOrder[1]);
  });
  it("keeps disabled publish buttons awaiting user without marking submitted", async () => {
    const { page, click, mark } = fixture(false);
    await expect(submitKindEditor(page, mark)).rejects.toThrow("发布按钮暂不可用");
    expect(mark).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.calls[0][0]).toMatchObject({ trial: true });
  });
});
