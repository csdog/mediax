import {
  defaultThemePreference,
  parseThemePreference,
  themePreferenceStorageKey,
  type ThemePreference,
} from "../../shared/themePreference";

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(themePreferenceStorageKey));
  } catch {
    return defaultThemePreference;
  }
}

export function writeStoredPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(themePreferenceStorageKey, preference);
  } catch {
    // Ignore quota / private-mode failures; main process remains source of truth.
  }
}

export function applyThemePreference(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Keep the `.dark` class in sync with preference + OS appearance. */
export function installSystemTheme() {
  if (typeof window.matchMedia !== "function") {
    applyThemePreference(readStoredPreference());
    return () => undefined;
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => applyThemePreference(readStoredPreference());
  sync();
  media.addEventListener("change", sync);
  void window.desktop?.themePreference?.().then((preference) => {
    writeStoredPreference(preference);
    applyThemePreference(preference);
  });
  return () => media.removeEventListener("change", sync);
}
