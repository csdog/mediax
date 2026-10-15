import { log } from "../logging";
import type { Database } from "../storage/Database";

/** Promotes due `scheduled` targets to `pending` while the app is running. */
export class ScheduleService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  constructor(
    private db: Database,
    private onPromoted?: (taskIds: string[]) => void,
  ) {}

  start() {
    this.stopped = false;
    this.tick();
  }

  stop() {
    this.stopped = true;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Call after create/reschedule so the next wake aligns with the new time. */
  kick() {
    if (this.stopped) return;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tick();
  }

  private tick() {
    if (this.stopped) return;
    try {
      const promoted = this.db.promoteDueScheduled();
      if (promoted.length) {
        log.info("Schedule due; enqueueing tasks", { count: promoted.length });
        this.onPromoted?.(promoted);
      }
    } catch (error) {
      log.error("Schedule tick failed", error);
    }
    const next = this.db.nextScheduledAt();
    const delay = next
      ? Math.min(60_000, Math.max(1_000, new Date(next).getTime() - Date.now() + 250))
      : 30_000;
    this.timer = setTimeout(() => this.tick(), delay);
  }
}
