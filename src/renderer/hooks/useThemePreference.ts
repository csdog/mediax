import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyThemePreference, writeStoredPreference } from "@/lib/systemTheme";
import { defaultThemePreference, type ThemePreference } from "../../shared/themePreference";

const key = ["desktop", "theme-preference"] as const;

export function useThemePreference() {
  const client = useQueryClient();
  const preference = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.themePreference(),
  });
  const save = useMutation({
    mutationFn: (next: ThemePreference) => window.desktop.setThemePreference(next),
    onSuccess: (next) => {
      client.setQueryData(key, next);
      writeStoredPreference(next);
      applyThemePreference(next);
    },
  });
  return {
    preference: preference.data ?? defaultThemePreference,
    setPreference: (next: ThemePreference) => {
      writeStoredPreference(next);
      applyThemePreference(next);
      save.mutate(next);
    },
    busy: save.isPending,
  };
}
