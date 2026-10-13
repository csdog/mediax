import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const publishSettingsKey = ["desktop", "silent-publish"] as const;

export function usePublishSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: publishSettingsKey,
    queryFn: () => window.desktop.publishSettings(),
  });
  const save = useMutation({
    mutationFn: (silent: boolean) => window.desktop.setSilentPublish(silent),
    onSuccess: (result) => client.setQueryData(publishSettingsKey, result),
  });
  return {
    silentPublish: settings.data?.silent ?? false,
    setSilentPublish: (silent: boolean) => save.mutate(silent),
  };
}
