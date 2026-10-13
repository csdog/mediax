import { nativeTheme } from "electron";
import {
  defaultThemePreference,
  parseThemePreference,
  type ThemePreference,
} from "../../shared/themePreference";

export function applyThemePreference(preference: ThemePreference) {
  nativeTheme.themeSource = preference;
}

export function readThemePreference(get: (key: string) => unknown): ThemePreference {
  return parseThemePreference(get("themePreference"));
}

export function saveThemePreference(
  set: (key: string, value: unknown) => void,
  preference: ThemePreference,
): ThemePreference {
  const next = parseThemePreference(preference);
  set("themePreference", next);
  applyThemePreference(next);
  return next;
}

export function installThemePreference(get: (key: string) => unknown) {
  applyThemePreference(readThemePreference(get) || defaultThemePreference);
}
