import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateStatus } from "../../shared/models";

const idle: UpdateStatus = {
  state: "idle",
  currentVersion: "0.0.0",
  availableVersion: null,
  progress: null,
  message: null,
  canCheck: false,
  canInstall: false,
};

const autoKey = ["desktop", "auto-update"] as const;

export function useAppUpdate() {
  const client = useQueryClient();
  const [status, setStatus] = useState<UpdateStatus>(idle);
  const [busy, setBusy] = useState(false);
  const autoUpdate = useQuery({
    queryKey: autoKey,
    queryFn: () => window.desktop.autoUpdateEnabled(),
  });
  const saveAuto = useMutation({
    mutationFn: (enabled: boolean) => window.desktop.setAutoUpdateEnabled(enabled),
    onSuccess: (enabled) => {
      client.setQueryData(autoKey, enabled);
      void window.desktop.updateStatus().then(setStatus);
    },
  });
  useEffect(() => {
    let active = true;
    void window.desktop.updateStatus().then((next) => {
      if (active) setStatus(next);
    });
    const stop = window.desktop.onUpdateStatus((next) => setStatus(next));
    return () => {
      active = false;
      stop();
    };
  }, []);
  useEffect(() => {
    const apply = (next: UpdateStatus) => setStatus(next);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<UpdateStatus>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener("mediax:update-status", receive);
    return () => window.removeEventListener("mediax:update-status", receive);
  }, []);
  return {
    status,
    autoUpdateEnabled: autoUpdate.data ?? true,
    setAutoUpdateEnabled: (enabled: boolean) => saveAuto.mutate(enabled),
    checkForUpdates: async () => {
      setBusy(true);
      try {
        setStatus(await window.desktop.checkForUpdates());
      } finally {
        setBusy(false);
      }
    },
    installUpdate: async () => {
      setBusy(true);
      try {
        setStatus(await window.desktop.installUpdate());
      } finally {
        setBusy(false);
      }
    },
    busy,
  };
}
