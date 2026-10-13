export type ThemePreference = "system" | "light" | "dark";

export const defaultThemePreference: ThemePreference = "system";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : defaultThemePreference;
}

export const themePreferenceStorageKey = "themePreference";
