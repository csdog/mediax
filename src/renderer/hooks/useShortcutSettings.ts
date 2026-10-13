import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { defaultShortcutMap } from "../../shared/shortcutCatalog";
import type { ShortcutSettings } from "../../shared/models";

const shortcutKey = ["desktop", "shortcut"] as const;

export function useShortcutSettings() {
  const client = useQueryClient();
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(defaultShortcutMap);
  const [shortcutMessage, setShortcutMessage] = useState("");
  const settings = useQuery({
    queryKey: shortcutKey,
    queryFn: () => window.desktop.shortcutSettings(),
  });
  useEffect(() => {
    if (settings.data) {
      setShortcuts(settings.data.shortcuts ?? defaultShortcutMap());
      if (settings.data.error) setShortcutMessage(settings.data.error);
    }
  }, [settings.data]);
  useEffect(() => {
    if (settings.error) setShortcutMessage(settings.error.message);
  }, [settings.error]);
  const save = useMutation({
    mutationKey: ["desktop", "save-shortcut"],
    mutationFn: ({ id, accelerator }: { id: string; accelerator: string }) =>
      id === "global-show"
        ? window.desktop.setGlobalShortcut(accelerator)
        : window.desktop.setShortcut(id, accelerator),
    retry: false,
    onSuccess: (result, variables) => {
      client.setQueryData(shortcutKey, result);
      setShortcuts(result.shortcuts ?? defaultShortcutMap());
      setShortcutMessage(messageFor(variables.id, result));
    },
    onError: (error) => {
      const previous = client.getQueryData<ShortcutSettings>(shortcutKey);
      if (previous?.shortcuts) setShortcuts(previous.shortcuts);
      setShortcutMessage(error.message);
    },
  });
  const reset = useMutation({
    mutationKey: ["desktop", "reset-shortcuts"],
    mutationFn: () => window.desktop.resetShortcuts(),
    retry: false,
    onSuccess: (result) => {
      client.setQueryData(shortcutKey, result);
      setShortcuts(result.shortcuts ?? defaultShortcutMap());
      setShortcutMessage("已全部重置为默认快捷键。");
    },
    onError: (error) => {
      const previous = client.getQueryData<ShortcutSettings>(shortcutKey);
      if (previous?.shortcuts) setShortcuts(previous.shortcuts);
      setShortcutMessage(error.message);
    },
  });
  const saveAccelerator = async (id: string, accelerator: string) => {
    setShortcutMessage("");
    setShortcuts((current) => ({ ...current, [id]: accelerator }));
    try {
      await save.mutateAsync({ id, accelerator });
    } catch {
      // onError already restores shortcuts and sets the message.
    }
  };
  const resetAll = async () => {
    setShortcutMessage("");
    setShortcuts(defaultShortcutMap());
    try {
      await reset.mutateAsync();
    } catch {
      // onError already restores shortcuts and sets the message.
    }
  };
  return {
    shortcuts,
    shortcutMessage,
    setShortcutMessage,
    shortcutBusy: settings.isFetching || save.isPending || reset.isPending,
    saveAccelerator,
    resetAll,
  };
}

function messageFor(id: string, result: ShortcutSettings) {
  if (id === "global-show") {
    return result.registered
      ? "已保存，可在其他应用中按快捷键呼出窗口。"
      : "已关闭全局呼出快捷键。";
  }
  return result.shortcuts?.[id] ? "已保存快捷键。" : "已清除快捷键。";
}
