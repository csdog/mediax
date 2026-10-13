import { mark } from "./perfMarks";

export type LifecyclePhase = "starting" | "restored" | "eventually";

type Work = () => void;

/**
 * Lightweight port of VS Code's Starting → Restored → Eventually phases.
 * Heavy background work should register with whenEventually().
 */
export class AppLifecycle {
  private phase: LifecyclePhase = "starting";
  private eventuallyQueue: Work[] = [];
  private eventuallyTimer?: ReturnType<typeof setTimeout>;
  private forceTimer?: ReturnType<typeof setTimeout>;

  get current() {
    return this.phase;
  }

  markRestored() {
    if (this.phase !== "starting") return;
    this.phase = "restored";
    mark("mediax/didRestored");
    // Match VS Code: enter Eventually after a short delay, preferring an idle tick.
    this.eventuallyTimer = setTimeout(() => this.enterEventually(), 2_500);
    this.forceTimer = setTimeout(() => this.enterEventually(), 5_000);
  }

  whenEventually(work: Work) {
    if (this.phase === "eventually") {
      setTimeout(work, 0);
      return;
    }
    this.eventuallyQueue.push(work);
  }

  private enterEventually() {
    if (this.phase === "eventually") return;
    clearTimeout(this.eventuallyTimer);
    clearTimeout(this.forceTimer);
    this.phase = "eventually";
    mark("mediax/didEventually");
    const jobs = this.eventuallyQueue.splice(0);
    for (const job of jobs) {
      try {
        job();
      } catch {
        // Callers log their own failures; keep the queue resilient.
      }
    }
  }
}
