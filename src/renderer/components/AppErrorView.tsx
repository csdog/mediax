import { userErrorMessage } from "../../shared/userError";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export type AppErrorViewProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  secondaryAction?: ReactNode;
  /** full = route-level; panel = embedded section */
  variant?: "full" | "panel";
  className?: string;
};

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error == null) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function errorStack(error: unknown) {
  return error instanceof Error ? (error.stack ?? "") : "";
}

/** Shared friendly error surface for routes and panel boundaries. */
export function AppErrorView({
  title,
  description,
  error,
  onRetry,
  secondaryAction,
  variant = "full",
  className,
}: AppErrorViewProps) {
  const detail = error == null ? "" : userErrorMessage(error);
  const heading = title ?? (variant === "full" ? "页面暂时无法显示" : "这部分暂时无法显示");
  const body = description ?? "可以重试，或先使用其他功能。详细信息已写入本地日志。";

  return (
    <div
      className={cn(
        "app-error-view",
        variant === "full" ? "app-error-view--full" : "app-error-view--panel",
        className,
      )}
      role="alert"
    >
      {variant === "full" ? <div className="app-error-view__glow" aria-hidden /> : null}
      <div className="app-error-view__stage">
        <div className="app-error-view__mark" aria-hidden>
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" className="app-error-view__mark-ring" />
            <path
              d="M20 34.5c4.2-7.2 8.6-10.8 12-10.8s7.8 3.6 12 10.8"
              className="app-error-view__mark-arc"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="32" cy="40" r="2.5" className="app-error-view__mark-dot" />
          </svg>
        </div>
        {variant === "full" ? <p className="app-error-view__brand">MediaX</p> : null}
        <div className="app-error-view__copy">
          <h2 className="app-error-view__title">{heading}</h2>
          <p className="app-error-view__desc">{body}</p>
          {detail ? <p className="app-error-view__prod-hint">{detail}</p> : null}
        </div>
        <div className="app-error-view__actions">
          {onRetry ? (
            <Button type="button" size={variant === "full" ? "lg" : "sm"} onClick={onRetry}>
              重试
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}
