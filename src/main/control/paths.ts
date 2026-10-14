import { homedir } from "node:os";
import { join } from "node:path";

/** Shared with mediax-agent (`MEDIAX_HOME` or `~/.mediax`). */
export function mediaxHomeDir(): string {
  return process.env.MEDIAX_HOME?.trim() || join(homedir(), ".mediax");
}

export function controlConfigPath(): string {
  return process.env.MEDIAX_CONTROL_CONFIG?.trim() || join(mediaxHomeDir(), "control.json");
}
