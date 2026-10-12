import { queryOptions, QueryClient } from "@tanstack/react-query";
export const accountsOptions = queryOptions({
  queryKey: ["desktop", "accounts"],
  queryFn: () => window.desktop.accounts(),
  staleTime: 1000,
});
export const historyOptions = queryOptions({
  queryKey: ["desktop", "history"],
  queryFn: () => window.desktop.history(),
});
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      // Publishing and other side effects must never be retried automatically.
      mutations: { retry: false },
    },
  });
}
