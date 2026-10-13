import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

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
      <div className="panel-error" role="alert">
        <h3>{this.props.title ?? "这部分暂时无法显示"}</h3>
        <p>{this.props.description ?? "请重试；若仍失败，可先切换到其他分类或返回工作区。"}</p>
        <Button type="button" variant="outline" onClick={() => this.setState({ error: null })}>
          重试
        </Button>
      </div>
    );
  }
}
