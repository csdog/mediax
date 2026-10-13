import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const key = ["desktop", "open-at-login"] as const;

export function useOpenAtLogin() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.openAtLogin(),
  });
  const save = useMutation({
    mutationFn: (openAtLogin: boolean) => window.desktop.setOpenAtLogin(openAtLogin),
    onSuccess: (result) => client.setQueryData(key, result),
  });
  return {
    openAtLogin: status.data?.openAtLogin ?? false,
    detail: status.data?.detail ?? null,
    setOpenAtLogin: (openAtLogin: boolean) => save.mutate(openAtLogin),
  };
}
