import type { Database } from "../storage/Database";
import type { TaskTarget } from "../../shared/models";
export type TaskNotice = { title: string; body: string; taskId: string };

// Observe committed business state; never infer success from a submission alone.
export class TaskNotifications {
  private unsubscribe: () => void;
  private sent = new Map<string, string>();
  constructor(
    private db: Database,
    private show: (notice: TaskNotice) => void,
  ) {
    this.unsubscribe = db.onTargetChange((target) => this.changed(target));
  }
  private changed(target: TaskTarget) {
    if (["pending", "running"].includes(target.status)) {
      this.sent.delete(target.taskId);
      return;
    }
    const targets = this.db.targets(target.taskId);
    let title: string, body: string, key: string;
    if (target.status === "awaiting_user") {
      title = "需要人工处理";
      body = `${target.name} 需要登录或验证，请打开发布记录查看。`;
      key = `${target.id}:awaiting_user`;
    } else {
      if (targets.some((t) => ["pending", "running", "awaiting_user"].includes(t.status))) return;
      key = targets
        .map((t) => `${t.id}:${t.status}`)
        .sort()
        .join("|");
      const verified = targets.filter((t) => t.status === "verified").length;
      if (targets.some((t) => ["unknown", "submitted"].includes(t.status))) {
        title = "发布结果待核验";
        body = "部分目标尚未确认结果，请检查发布记录，避免重复发布。";
      } else if (targets.some((t) => t.status === "failed")) {
        title = "发布任务有失败项";
        body = `${verified}/${targets.length} 个目标已确认成功，请查看失败项。`;
      } else {
        title = "发布完成";
        body = `${verified} 个目标已确认成功。`;
      }
    }
    if (this.sent.get(target.taskId) === key) return;
    this.sent.set(target.taskId, key);
    this.show({ title, body, taskId: target.taskId });
  }
  dispose() {
    this.unsubscribe();
    this.sent.clear();
  }
}
