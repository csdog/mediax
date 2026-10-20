import { powerSaveBlocker } from "electron";
import type { Database } from "../storage/Database";

/** Prevent idle system sleep while publish or scheduled targets are active. The display may still sleep. */
export class TaskPowerSave {
  private unsubscribe: () => void;
  private appBlocker: number | null = null;
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
      .some((target) =>
        ["scheduled", "pending", "running", "awaiting_user"].includes(target.status),
      );
    const want = this.enabled() && active;
    if (want) {
      if (this.appBlocker == null)
        this.appBlocker = powerSaveBlocker.start("prevent-app-suspension");
      return;
    }
    if (this.appBlocker != null) {
      powerSaveBlocker.stop(this.appBlocker);
      this.appBlocker = null;
    }
  }
  dispose() {
    this.unsubscribe();
    if (this.appBlocker != null) {
      powerSaveBlocker.stop(this.appBlocker);
      this.appBlocker = null;
    }
  }
}
