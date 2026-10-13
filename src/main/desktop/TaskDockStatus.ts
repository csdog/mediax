import { app, type BrowserWindow } from "electron";
import type { Database } from "../storage/Database";
import type { TaskTarget } from "../../shared/models";

export type DockSnapshot = {
  awaiting: number;
  /** `-1` clears the progress bar; `0..1` is completion within active tasks. */
  progress: number;
  needsAttention: boolean;
};

export function taskDockSnapshot(targets: TaskTarget[]): DockSnapshot {
  const awaiting = targets.filter((target) => target.status === "awaiting_user").length;
  const activeTaskIds = new Set(
    targets
      .filter((target) => ["pending", "running", "awaiting_user"].includes(target.status))
      .map((target) => target.taskId),
  );
  if (!activeTaskIds.size) return { awaiting, progress: -1, needsAttention: awaiting > 0 };
  let done = 0;
  let total = 0;
  for (const taskId of activeTaskIds) {
    const group = targets.filter((target) => target.taskId === taskId);
    total += group.length;
    done += group.filter(
      (target) => !["pending", "running", "awaiting_user"].includes(target.status),
    ).length;
  }
  return {
    awaiting,
    progress: total ? done / total : 0,
    needsAttention: awaiting > 0,
  };
}

/** Keep Dock / taskbar badge and progress aligned with publish targets. */
export class TaskDockStatus {
  private unsubscribe: () => void;
  private attentionArmed = false;
  constructor(
    private db: Database,
    private window: BrowserWindow,
  ) {
    this.unsubscribe = db.onTargetChange(() => this.sync());
    this.sync();
  }
  sync() {
    const snapshot = taskDockSnapshot(this.db.targets());
    if (process.platform === "darwin")
      app.dock?.setBadge(snapshot.awaiting > 0 ? String(snapshot.awaiting) : "");
    else app.setBadgeCount(snapshot.awaiting);
    if (!this.window.isDestroyed()) this.window.setProgressBar(snapshot.progress);
    if (snapshot.needsAttention && !this.attentionArmed) {
      this.attentionArmed = true;
      if (process.platform === "darwin") app.dock?.bounce("informational");
      else if (!this.window.isDestroyed()) this.window.flashFrame(true);
    }
    if (!snapshot.needsAttention) {
      this.attentionArmed = false;
      if (!this.window.isDestroyed()) this.window.flashFrame(false);
    }
  }
  dispose() {
    this.unsubscribe();
    if (process.platform === "darwin") app.dock?.setBadge("");
    else app.setBadgeCount(0);
    if (!this.window.isDestroyed()) {
      this.window.setProgressBar(-1);
      this.window.flashFrame(false);
    }
  }
}
