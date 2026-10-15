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
export function calendarOptions(from: string, to: string) {
  return queryOptions({
    queryKey: ["desktop", "calendar", from, to],
    queryFn: () => window.desktop.calendar({ from, to }),
  });
}
export function analyticsOptions(days: number) {
  return queryOptions({
    queryKey: ["desktop", "analytics", days],
    queryFn: () => window.desktop.analyticsSummary(days),
  });
}
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      // Publishing and other side effects must never be retried automatically.
      mutations: { retry: false },
    },
  });
}
