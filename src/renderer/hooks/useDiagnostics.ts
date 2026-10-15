import { userErrorMessage } from "../../shared/userError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const key = ["desktop", "diagnostics"] as const;
const autoRefreshMs = 3_000;

export function useDiagnostics() {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const report = useQuery({
    queryKey: key,
    queryFn: () => window.desktop.diagnostics(),
    refetchInterval: autoRefresh ? autoRefreshMs : false,
    refetchIntervalInBackground: false,
  });
  const exporting = useMutation({
    mutationFn: () => window.desktop.exportDiagnostics(),
    onSuccess: (path) => {
      setMessage(path ? `已导出到 ${path}` : "已取消导出");
    },
    onError: (error) => {
      setMessage(userErrorMessage(error));
    },
  });
  return {
    report: report.data ?? null,
    loading: report.isFetching,
    message,
    autoRefresh,
    setAutoRefresh,
    refresh: () => {
      setMessage("");
      void client.invalidateQueries({ queryKey: key });
    },
    exportReport: () => exporting.mutate(),
    exporting: exporting.isPending,
    revealLog: async () => {
      setMessage("");
      await window.desktop.revealLogFile();
      setMessage("已在文件管理器中显示日志文件");
    },
  };
}
