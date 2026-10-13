import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultDesktopBehavior, type DesktopBehavior } from "../../shared/desktopBehavior";

const key = ["desktop", "desktop-behavior"] as const;

export function useDesktopBehavior() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.desktopBehavior(),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<DesktopBehavior>) => window.desktop.setDesktopBehavior(patch),
    onSuccess: (result) => client.setQueryData(key, result),
  });
  return {
    settings: settings.data ?? defaultDesktopBehavior,
    setSettings: (patch: Partial<DesktopBehavior>) => save.mutate(patch),
  };
}
