import type { ErrorComponentProps } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppErrorView, errorMessage, errorStack } from "@/components/AppErrorView";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const navigate = useNavigate();
  const detail = errorMessage(error);
  const stack = errorStack(error);

  if (detail || stack) {
    console.error("Route error", detail, stack || error);
  }

  return (
    <AppErrorView
      variant="full"
      title="这里暂时走不通了"
      description={
        import.meta.env.DEV
          ? "开发模式下会附带技术详情，方便定位。"
          : "可以重试当前页面，或先回到账号继续其他工作。详情已写入本地日志。"
      }
      error={error}
      onRetry={reset}
      secondaryAction={
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigate({ to: "/accounts" });
          }}
        >
          返回账号
        </Button>
      }
    />
  );
}
