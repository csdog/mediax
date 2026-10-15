import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppErrorView } from "@/components/AppErrorView";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
};

type State = { error: Error | null };

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Panel render failed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <AppErrorView
        variant="panel"
        title={this.props.title ?? "这部分暂时无法显示"}
        description={
          this.props.description ??
          (import.meta.env.DEV
            ? "开发模式下会显示技术详情。"
            : "请重试；若仍失败，可先切换到其他功能。")
        }
        error={this.state.error}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}
