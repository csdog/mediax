/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThemePreference, installSystemTheme } from "../../src/renderer/lib/systemTheme";
import { themePreferenceStorageKey } from "../../src/shared/themePreference";

describe("installSystemTheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem(themePreferenceStorageKey);
    vi.restoreAllMocks();
  });

  it("toggles the dark class from prefers-color-scheme when following system", () => {
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

  it("honors an explicit light or dark preference", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    applyThemePreference("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    applyThemePreference("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
