import { app, session } from "electron";
import type { Database } from "../storage/Database";
import { log } from "../logging";
import { mark } from "./perfMarks";

/** Drop stale Chromium code caches after an app version bump (VS Code pattern). */
export async function invalidateCodeCacheIfNeeded(db: Database) {
  const version = app.getVersion();
  const key = "electronCodeCacheVersion";
  if (db.setting(key) === version) return;
  mark("mediax/willClearCodeCache");
  try {
    await session.defaultSession.clearCodeCaches({});
    db.setSetting(key, version);
    mark("mediax/didClearCodeCache");
  } catch (error) {
    log.warn("Failed to clear code caches", error);
  }
}
