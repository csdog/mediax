import { userErrorMessage } from "../../shared/userError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  formatBytes,
  storageCleanupActions,
  type StorageCleanupId,
  type StorageUsage,
} from "../../shared/storageUsage";

const key = ["desktop", "storageUsage"] as const;
const diagnosticsKey = ["desktop", "diagnostics"] as const;
const accountsKey = ["desktop", "accounts"] as const;

export function useStorageUsage() {
  const client = useQueryClient();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.storageUsage(false),
  });
  const refreshUsage = async () => {
    await client.fetchQuery({
      queryKey: key,
      queryFn: () => window.desktop.storageUsage(true),
    });
  };
  const clearing = useMutation({
    mutationFn: (id: StorageCleanupId) => window.desktop.clearStorage(id),
    onSuccess: async (result, id) => {
      if (!result) {
        setMessage(null);
        return;
      }
      const action = storageCleanupActions.find((item) => item.id === id);
      setMessage({
        text:
          result.freedBytes > 0
            ? `已清理 ${formatBytes(result.freedBytes)} ${action?.doneLabel ?? ""}`.trim()
            : (action?.emptyMessage ?? "无需清理"),
        error: false,
      });
      await refreshUsage();
      if (id === "logs") void client.invalidateQueries({ queryKey: diagnosticsKey });
      if (id === "sessions") void client.invalidateQueries({ queryKey: accountsKey });
    },
    onError: (error) => {
      setMessage({
        text: userErrorMessage(error),
        error: true,
      });
    },
  });
  return {
    storage: (query.data ?? null) as StorageUsage | null,
    loading: query.isFetching,
    clearingId: clearing.isPending ? (clearing.variables ?? null) : null,
    message: message?.text ?? "",
    messageError: message?.error ?? false,
    refresh: () => {
      setMessage(null);
      void refreshUsage();
    },
    clearStorage: (id: StorageCleanupId) => clearing.mutate(id),
  };
}
