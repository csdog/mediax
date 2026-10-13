import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div className="route-error" role="alert">
      <h2>页面出了点问题</h2>
      <p>可以重试，或返回继续使用其他功能。详细信息已写入本地日志。</p>
      {import.meta.env.DEV && detail ? <p className="route-error-detail">{detail}</p> : null}
      <div className="route-error-actions">
        <Button type="button" onClick={reset}>
          重试
        </Button>
      </div>
    </div>
  );
}
