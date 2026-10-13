import { powerSaveBlocker } from "electron";
import type { Database } from "../storage/Database";

/** Prevent app suspension while publish targets are still active. */
export class TaskPowerSave {
  private unsubscribe: () => void;
  private blocker: number | null = null;
  constructor(
    private db: Database,
    private enabled: () => boolean,
  ) {
    this.unsubscribe = db.onTargetChange(() => this.sync());
    this.sync();
  }
  sync() {
    const active = this.db
      .targets()
      .some((target) => ["pending", "running", "awaiting_user"].includes(target.status));
    const want = this.enabled() && active;
    if (want && this.blocker == null) {
      this.blocker = powerSaveBlocker.start("prevent-app-suspension");
      return;
    }
    if (!want && this.blocker != null) {
      powerSaveBlocker.stop(this.blocker);
      this.blocker = null;
    }
  }
  dispose() {
    this.unsubscribe();
    if (this.blocker != null) {
      powerSaveBlocker.stop(this.blocker);
      this.blocker = null;
    }
  }
}
