import { useEffect, useState } from "react";
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

export function useAppUpdate() {
  const [status, setStatus] = useState<UpdateStatus>(idle);
  const [busy, setBusy] = useState(false);
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
    window.addEventListener("media-post:update-status", receive);
    return () => window.removeEventListener("media-post:update-status", receive);
  }, []);
  return {
    status,
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
