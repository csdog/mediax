import { describe, expect, it, vi } from "vitest";
import { parseThemePreference } from "../../src/shared/themePreference";
import { readThemePreference, saveThemePreference } from "../../src/main/desktop/themePreference";

vi.mock("electron", () => ({
  nativeTheme: { themeSource: "system" },
}));

describe("theme preference", () => {
  it("defaults unknown values to system", () => {
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("neon")).toBe("system");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("reads and persists preference while updating nativeTheme", async () => {
    const { nativeTheme } = await import("electron");
    const store = new Map<string, unknown>();
    expect(readThemePreference((key) => store.get(key))).toBe("system");
    expect(saveThemePreference((key, value) => store.set(key, value), "dark")).toBe("dark");
    expect(store.get("themePreference")).toBe("dark");
    expect(nativeTheme.themeSource).toBe("dark");
  });
});
