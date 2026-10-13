/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSystemTheme } from "../../src/renderer/lib/systemTheme";

describe("installSystemTheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  it("toggles the dark class from prefers-color-scheme", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: true,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as MediaQueryList);

    const stop = installSystemTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    media.matches = false;
    for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    stop();
    expect(listeners.size).toBe(0);
  });
});
