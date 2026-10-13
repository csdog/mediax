import { existsSync } from "node:fs";
import { join, parse } from "node:path";

export function logFilePath(mode: string, paths: { project: string; userData: string }) {
  return join(mode === "development" ? paths.project : paths.userData, "logs", "main.log");
}

/** Archive name after rotation, e.g. `main.2026-10-13.log` (same-day collisions get `.1`, `.2`, …). */
export function archivedLogPath(filePath: string, when = new Date(), exists = existsSync) {
  const { dir, name, ext } = parse(filePath);
  const stamp = [
    when.getFullYear(),
    String(when.getMonth() + 1).padStart(2, "0"),
    String(when.getDate()).padStart(2, "0"),
  ].join("-");
  let candidate = join(dir, `${name}.${stamp}${ext}`);
  for (let n = 1; exists(candidate); n++) {
    candidate = join(dir, `${name}.${stamp}.${n}${ext}`);
  }
  return candidate;
}
