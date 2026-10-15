import { homedir } from "node:os";
import { join } from "node:path";

/** Product root shared with mediax-agent (`MEDIAX_HOME` or `~/.mediax`). */
export function mediaxHomeDir(): string {
  return process.env.MEDIAX_HOME?.trim() || join(homedir(), ".mediax");
}

/** Agent tree under product root (`~/.mediax/agent`). */
export function mediaxAgentHomeDir(): string {
  return join(mediaxHomeDir(), "agent");
}

export function controlConfigPath(): string {
  return process.env.MEDIAX_CONTROL_CONFIG?.trim() || join(mediaxAgentHomeDir(), "control.json");
}
