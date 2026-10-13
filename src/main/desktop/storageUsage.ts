import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { app, session } from "electron";
import {
  buildStorageUsage,
  type StorageCleanupId,
  type StorageUsage,
} from "../../shared/storageUsage";
import { logFilePath } from "../log-path";
import { readLogConfig } from "../../shared/logging";
import { log } from "../logging";

export const appCacheDirectoryNames = [
  "Cache",
  "Code Cache",
  "GPUCache",
  "GPUPersistentCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "GraphiteDawnCache",
  "blob_storage",
  "Shared Dictionary",
] as const;

const cacheNames = new Set<string>(appCacheDirectoryNames);

async function entrySize(path: string): Promise<number> {
  try {
    const info = await stat(path);
    if (info.isFile() || info.isSymbolicLink()) return info.size;
    if (!info.isDirectory()) return 0;
    const children = await readdir(path, { withFileTypes: true });
    let total = 0;
    for (const child of children) {
      const childPath = join(path, child.name);
      if (child.isSymbolicLink()) {
        try {
          total += (await stat(childPath)).size;
        } catch {
          /* skip broken links */
        }
        continue;
      }
      if (child.isFile()) {
        total += (await stat(childPath)).size;
        continue;
      }
      if (child.isDirectory()) total += await entrySize(childPath);
    }
    return total;
  } catch {
    return 0;
  }
}

async function namedSizes(root: string, names: string[]) {
  const sizes = await Promise.all(names.map((name) => entrySize(join(root, name))));
  return sizes.reduce((sum, value) => sum + value, 0);
}

/** Split Partitions into login/session bytes vs Chromium cache directories. */
async function partitionUsage(partitionsDir: string) {
  const entries = await readdir(partitionsDir, { withFileTypes: true }).catch(() => []);
  let sessions = 0;
  let cache = 0;
  for (const entry of entries) {
    const path = join(partitionsDir, entry.name);
    if (!entry.isDirectory()) {
      sessions += await entrySize(path);
      continue;
    }
    const children = await readdir(path, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      const size = await entrySize(join(path, child.name));
      if (cacheNames.has(child.name)) cache += size;
      else sessions += size;
    }
  }
  return { sessions, cache };
}

async function clearNamedCaches(root: string) {
  const freedBytes = await namedSizes(root, [...appCacheDirectoryNames]);
  await Promise.all(
    appCacheDirectoryNames.map((name) =>
      rm(join(root, name), { recursive: true, force: true }).catch((error) => {
        log.warn(`Failed to remove cache directory ${name} under ${root}`, error);
      }),
    ),
  );
  return freedBytes;
}

let cached: { at: number; value: StorageUsage } | null = null;
const cacheTtlMs = 15_000;

export function invalidateStorageUsageCache() {
  cached = null;
}

function activeLogPaths() {
  const userData = app.getPath("userData");
  const config = readLogConfig(import.meta.env);
  const logFile = logFilePath(config.mode, {
    project: app.getAppPath(),
    userData,
  });
  const logsDir = dirname(logFile);
  const dirs = [logsDir];
  const userDataLogs = join(userData, "logs");
  if (userDataLogs !== logsDir) dirs.push(userDataLogs);
  return { logFile, dirs };
}

async function clearLogsDirectory(dir: string, activeLogFile: string) {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (path === activeLogFile || (entry.isFile() && entry.name === basename(activeLogFile))) {
        await writeFile(path, "", "utf8");
        return;
      }
      await rm(path, { recursive: true, force: true }).catch((error) => {
        log.warn(`Failed to remove log entry ${entry.name}`, error);
      });
    }),
  );
  if (!entries.some((entry) => entry.name === basename(activeLogFile))) {
    await writeFile(activeLogFile, "", "utf8");
  }
}

/** Delete Chromium disk caches under userData and account partitions; keep login state. */
export async function clearAppCache(): Promise<{ freedBytes: number }> {
  const userData = app.getPath("userData");
  const partitionsDir = join(userData, "Partitions");
  const partitionEntries = await readdir(partitionsDir, { withFileTypes: true }).catch(() => []);
  let freedBytes = await clearNamedCaches(userData);
  for (const entry of partitionEntries) {
    if (!entry.isDirectory()) continue;
    const root = join(partitionsDir, entry.name);
    freedBytes += await clearNamedCaches(root);
    try {
      const partition = session.fromPartition(`persist:${entry.name}`);
      await partition.clearCache();
      await partition.clearCodeCaches({});
    } catch (error) {
      log.warn(`Failed to clear session caches for ${entry.name}`, error);
    }
  }
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearCodeCaches({});
  } catch (error) {
    log.warn("Failed to clear default session caches", error);
  }
  invalidateStorageUsageCache();
  return { freedBytes };
}

/** Truncate active main.log and remove rotated archives under the logs directories. */
export async function clearAppLogs(): Promise<{ freedBytes: number }> {
  const { logFile, dirs } = activeLogPaths();
  const sizes = await Promise.all(dirs.map((dir) => entrySize(dir)));
  const freedBytes = sizes.reduce((sum, value) => sum + value, 0);
  for (const dir of dirs) await clearLogsDirectory(dir, logFile);
  invalidateStorageUsageCache();
  log.info("Application logs cleared");
  return { freedBytes };
}

/** Delete local publish task asset copies under userData/task-assets. */
export async function clearAppAssets(): Promise<{ freedBytes: number }> {
  const dir = join(app.getPath("userData"), "task-assets");
  const freedBytes = await entrySize(dir);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  invalidateStorageUsageCache();
  log.info("Application task assets cleared");
  return { freedBytes };
}

/** Remove Chromium persist partitions after callers close account browsers. */
export async function clearAppSessions(
  beforeRemove: () => Promise<void>,
): Promise<{ freedBytes: number }> {
  const dir = join(app.getPath("userData"), "Partitions");
  const freedBytes = await entrySize(dir);
  await beforeRemove();
  await rm(dir, { recursive: true, force: true });
  invalidateStorageUsageCache();
  log.info("Application browser sessions cleared");
  return { freedBytes };
}

export async function clearStorageCategory(
  id: StorageCleanupId,
  beforeSessions?: () => Promise<void>,
): Promise<{ freedBytes: number }> {
  if (id === "cache") return clearAppCache();
  if (id === "logs") return clearAppLogs();
  if (id === "assets") return clearAppAssets();
  if (!beforeSessions) throw new Error("清理浏览器会话缺少账号服务");
  return clearAppSessions(beforeSessions);
}

/** Codex-style local disk breakdown for mediax userData (+ logs dir if outside). */
export async function collectStorageUsage(force = false): Promise<StorageUsage> {
  if (!force && cached && Date.now() - cached.at < cacheTtlMs) return cached.value;
  const userData = app.getPath("userData");
  const config = readLogConfig(import.meta.env);
  const logFile = logFilePath(config.mode, {
    project: app.getAppPath(),
    userData,
  });
  const logsDir = dirname(logFile);
  const partitionsDir = join(userData, "Partitions");
  const [database, partitions, assets, logsInUserData, rootCache, rootEntries] = await Promise.all([
    namedSizes(userData, ["mediax.sqlite", "mediax.sqlite-shm", "mediax.sqlite-wal"]),
    partitionUsage(partitionsDir),
    entrySize(join(userData, "task-assets")),
    entrySize(join(userData, "logs")),
    namedSizes(userData, [...cacheNames]),
    readdir(userData, { withFileTypes: true }).catch(() => []),
  ]);

  const counted = new Set([
    "mediax.sqlite",
    "mediax.sqlite-shm",
    "mediax.sqlite-wal",
    "Partitions",
    "task-assets",
    "logs",
    ...cacheNames,
  ]);
  let other = 0;
  for (const entry of rootEntries) {
    if (counted.has(entry.name)) continue;
    if (
      entry.name.startsWith("Singleton") ||
      entry.name === "DevToolsActivePort" ||
      entry.name === "Crashpad"
    )
      continue;
    other += await entrySize(join(userData, entry.name));
  }

  // Dev mode may keep logs under the project tree outside userData.
  let logs = logsInUserData;
  if (!logsDir.startsWith(userData)) logs += await entrySize(logsDir);

  const value = buildStorageUsage({
    database,
    sessions: partitions.sessions,
    assets,
    logs,
    cache: rootCache + partitions.cache,
    other,
  });
  cached = { at: Date.now(), value };
  return value;
}
