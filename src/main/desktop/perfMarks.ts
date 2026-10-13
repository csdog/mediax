import { performance } from "node:perf_hooks";
import { log } from "../logging";

/** VS Code-style marks: pairs of willX / didX for startup telemetry. */
export function mark(name: string) {
  performance.mark(name);
  log.debug(`[perf] ${name}`, { ms: Math.round(performance.now()) });
}

export function measure(name: string, startMark: string, endMark: string) {
  try {
    const entry = performance.measure(name, startMark, endMark);
    log.info(`[perf] ${name}`, { ms: Math.round(entry.duration) });
    return entry.duration;
  } catch {
    return null;
  }
}

export function startupPerfSnapshot() {
  return performance
    .getEntriesByType("mark")
    .filter((entry) => entry.name.startsWith("mediax/"))
    .map((entry) => ({ name: entry.name, ms: Math.round(entry.startTime) }));
}
