import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const shortcutKey = ["desktop", "shortcut"] as const;
export function useShortcutSettings() {
  const client = useQueryClient();
  const [shortcut, setShortcut] = useState("");
  const [shortcutMessage, setShortcutMessage] = useState("");
  const settings = useQuery({
    queryKey: shortcutKey,
    queryFn: () => window.desktop.shortcutSettings(),
  });
  useEffect(() => {
    if (settings.data) {
      setShortcut(settings.data.accelerator);
      if (settings.data.error) setShortcutMessage(settings.data.error);
    }
  }, [settings.data]);
  useEffect(() => {
    if (settings.error) setShortcutMessage(settings.error.message);
  }, [settings.error]);
  const save = useMutation({
    mutationKey: ["desktop", "save-shortcut"],
    mutationFn: (accelerator: string) => window.desktop.setGlobalShortcut(accelerator),
    retry: false,
    onSuccess: (result) => {
      client.setQueryData(shortcutKey, result);
      setShortcut(result.accelerator);
      setShortcutMessage(
        result.registered ? "已保存，可在其他应用中按快捷键呼出窗口。" : "已关闭全局呼出快捷键。",
      );
    },
    onError: (error) => setShortcutMessage(error.message),
  });
  const saveShortcut = () => {
    setShortcutMessage("");
    save.mutate(shortcut);
  };
  return {
    shortcut,
    setShortcut,
    shortcutMessage,
    setShortcutMessage,
    shortcutBusy: settings.isFetching || save.isPending,
    saveShortcut,
  };
}
