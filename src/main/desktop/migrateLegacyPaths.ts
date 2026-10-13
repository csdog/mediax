import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

/**
 * One-shot rename from media-post → mediax for userData and sqlite files.
 * Skipped when MEDIAX_USER_DATA overrides the path.
 */
export function migrateLegacyUserData() {
  if (process.env.MEDIAX_USER_DATA) return;

  const next = app.getPath("userData");
  const prev = join(dirname(next), "media-post");
  if (!existsSync(next) && existsSync(prev)) renameSync(prev, next);

  const oldDb = join(next, "media-post.sqlite");
  const newDb = join(next, "mediax.sqlite");
  if (!existsSync(newDb) && existsSync(oldDb)) {
    renameSync(oldDb, newDb);
    for (const suffix of ["-shm", "-wal"] as const) {
      const from = `${oldDb}${suffix}`;
      const to = `${newDb}${suffix}`;
      if (existsSync(from) && !existsSync(to)) renameSync(from, to);
    }
  }
}
