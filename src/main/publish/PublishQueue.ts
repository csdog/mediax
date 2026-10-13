import { Database } from "../storage/Database";
import { NeedsUser, NotSubmitted, type Publisher } from "../platforms/Publisher";
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
        let adapter: Publisher | undefined;
        const finish = (status: Status, error: string | null = null, url: string | null = null) => {
          this.db.transition(target.id, status, error, url);
          this.db.finishAttempt(attempt, status, error, url);
        };
        try {
          adapter = this.publisher(target);
          await adapter.prepare(task, target);
          await adapter.submit(task, target, () => {
            intent = true;
            this.db.transition(target.id, "submitted");
          });
          const url = await adapter.verify(task, target);
          finish("verified", null, url);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof NeedsUser && !intent) {
            finish("awaiting_user", message);
            return;
          }
          if (error instanceof NotSubmitted || !intent) {
            finish("failed", message);
            continue;
          }
          try {
            const url = adapter ? await adapter.verify(task, target) : null;
            if (url) {
              finish("verified", null, url);
              continue;
            }
          } catch {
            // The click may already have happened; do not ask the user to decide.
          }
          finish("unknown", message);
        }
      }
    }
  }
}
