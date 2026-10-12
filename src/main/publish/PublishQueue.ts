import { Database } from "../storage/Database";
import { NeedsUser, type Publisher } from "../platforms/Publisher";
import type { TaskTarget, Status } from "../../shared/models";
export class PublishQueue {
  private active: Promise<void> | null = null;
  constructor(
    private db: Database,
    private publisher: (target: TaskTarget) => Publisher,
  ) {}
  run(): Promise<void> {
    if (this.active) return this.active;
    this.active = this.drain().finally(() => {
      this.active = null;
    });
    return this.active;
  }
  async resume(id: string): Promise<void> {
    if (this.active) await this.active;
    const target = this.db.targets().find((t) => t.id === id);
    if (!target || !["awaiting_user", "pending"].includes(target.status))
      throw new Error("该目标不在等待人工处理状态");
    this.db.transition(id, "pending");
    await this.run();
  }
  private async drain(): Promise<void> {
    if (this.db.targets().some((t) => t.status === "awaiting_user")) return;
    for (const task of [...this.db.tasks()].reverse()) {
      for (const target of this.db.targets(task.id)) {
        if (target.status !== "pending") continue;
        const attempt = this.db.startAttempt(target.id);
        let intent = false;
        const finish = (status: Status, error: string | null = null, url: string | null = null) => {
          this.db.transition(target.id, status, error, url);
          this.db.finishAttempt(attempt, status, error, url);
        };
        try {
          const adapter = this.publisher(target);
          await adapter.prepare(task, target);
          // Durable intent precedes the click. A crash here requires verification, never blind retry.
          this.db.transition(target.id, "submitted");
          intent = true;
          await adapter.submit(task, target);
          const url = await adapter.verify(task, target);
          finish(url ? "verified" : "submitted", null, url);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof NeedsUser && !intent) {
            finish("awaiting_user", message);
            return;
          }
          finish(intent ? "unknown" : "failed", message);
        }
      }
    }
  }
}
