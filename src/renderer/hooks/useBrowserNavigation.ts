import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useBrowserNavigation(id: string | null, onNavigation?: () => void) {
  const client = useQueryClient();
  const callback = useRef(onNavigation);
  callback.current = onNavigation;
  useEffect(() => {
    return window.desktop.onBrowserNavigationChanged((viewId, navigation) => {
      const queryKey = ["desktop", "browser-navigation", viewId];
      void client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, navigation);
      if (viewId === id) callback.current?.();
    });
  }, [client, id]);
  return useQuery({
    queryKey: ["desktop", "browser-navigation", id],
    enabled: Boolean(id),
    queryFn: () => window.desktop.browserNavigation(id!),
    staleTime: Infinity,
  });
}
