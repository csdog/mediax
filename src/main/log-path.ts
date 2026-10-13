import { join } from "node:path";

export function logFilePath(mode: string, paths: { project: string; userData: string }) {
  return join(mode === "development" ? paths.project : paths.userData, "logs", "main.log");
}
