import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defaultNotificationSettings,
  type NotificationSettings,
} from "../../shared/notificationSettings";

const key = ["desktop", "notification-settings"] as const;
const permissionKey = ["desktop", "notification-permission"] as const;

export function useNotificationSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.notificationSettings(),
  });
  const permission = useQuery({
    queryKey: permissionKey,
    queryFn: () => window.desktop.notificationPermission(),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      window.desktop.setNotificationSettings(patch),
    onSuccess: (result) => client.setQueryData(key, result),
  });
  const test = useMutation({
    mutationFn: () => window.desktop.testNotification(),
  });
  return {
    settings: settings.data ?? defaultNotificationSettings,
    permission: permission.data ?? {
      supported: false,
      label: "未知",
      detail: "正在读取系统通知权限…",
    },
    setSettings: (patch: Partial<NotificationSettings>) => save.mutate(patch),
    openSystemSettings: () => void window.desktop.openNotificationSettings(),
    testNotification: () => test.mutateAsync(),
    testBusy: test.isPending,
    testMessage: test.data?.message ?? test.error?.message ?? "",
    refreshPermission: () => client.invalidateQueries({ queryKey: permissionKey }),
  };
}
