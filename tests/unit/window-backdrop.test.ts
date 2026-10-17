import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeWindow = {
  isDestroyed: () => false,
  isFocused: () => false,
  setBackgroundColor: vi.fn(),
  setVibrancy: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
};

vi.mock("electron", () => ({
  nativeTheme: {
    shouldUseDarkColors: false,
    prefersReducedTransparency: false,
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe("installWindowBackdrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("process", { ...process, platform: "darwin" });
  });

  it("keeps vibrancy during startup even when the window is inactive", async () => {
    const { installWindowBackdrop } = await import("../../src/main/desktop/windowBackdrop");
    const backdrop = installWindowBackdrop(fakeWindow as never);
    expect(fakeWindow.setBackgroundColor).toHaveBeenCalledWith("#00000000");
    expect(fakeWindow.setVibrancy).toHaveBeenCalledWith("menu");
    backdrop.endStartup();
    expect(fakeWindow.setBackgroundColor).toHaveBeenLastCalledWith("#f9f9f9");
    expect(fakeWindow.setVibrancy).toHaveBeenLastCalledWith(null);
  });
});
