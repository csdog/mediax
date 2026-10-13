import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultPublishSettings, type PublishSettings } from "../../shared/publishSettings";

const publishSettingsKey = ["desktop", "publish-settings"] as const;

export function usePublishSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: publishSettingsKey,
    queryFn: () => window.desktop.publishSettings(),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<PublishSettings>) => window.desktop.setPublishSettings(patch),
    onSuccess: (result) => client.setQueryData(publishSettingsKey, result),
  });
  const saveSilent = useMutation({
    mutationFn: (silent: boolean) => window.desktop.setSilentPublish(silent),
    onSuccess: (result) => client.setQueryData(publishSettingsKey, result),
  });
  const current = settings.data ?? defaultPublishSettings;
  return {
    publishSettings: current,
    silentPublish: current.silent,
    setSilentPublish: (silent: boolean) => saveSilent.mutate(silent),
    setPublishConcurrency: (concurrency: number) => save.mutate({ concurrency }),
    setPublishBandwidthLimitKbps: (bandwidthLimitKbps: number) =>
      save.mutate({ bandwidthLimitKbps }),
  };
}
