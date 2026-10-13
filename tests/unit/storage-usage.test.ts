import { describe, expect, it } from "vitest";
import {
  buildStorageUsage,
  formatBytes,
  storageCleanupActions,
} from "../../src/shared/storageUsage";
import { appCacheDirectoryNames } from "../../src/main/desktop/storageUsage";

describe("storage usage helpers", () => {
  it("formats byte sizes in Chinese units", () => {
    expect(formatBytes(0)).toBe("0 字节");
    expect(formatBytes(512)).toBe("512 字节");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(47.9 * 1024 * 1024)).toBe("47.9 MB");
    expect(formatBytes(1.9 * 1024 * 1024 * 1024)).toBe("1.9 GB");
  });

  it("aggregates category totals", () => {
    const usage = buildStorageUsage({
      database: 100,
      sessions: 200,
      assets: 50,
      logs: 25,
      cache: 300,
      other: 25,
    });
    expect(usage.totalBytes).toBe(700);
    expect(usage.categories.find((item) => item.id === "sessions")?.label).toBe("浏览器会话");
  });

  it("lists Chromium cache directories for cleanup", () => {
    expect(appCacheDirectoryNames).toContain("Cache");
    expect(appCacheDirectoryNames).toContain("Code Cache");
    expect(appCacheDirectoryNames).toContain("GPUCache");
    expect(appCacheDirectoryNames).toContain("Shared Dictionary");
  });

  it("marks only disposable dangerous cleanups in red", () => {
    expect(storageCleanupActions.map((item) => item.id)).toEqual([
      "cache",
      "logs",
      "assets",
      "sessions",
    ]);
    expect(storageCleanupActions.filter((item) => item.dangerous).map((item) => item.id)).toEqual([
      "assets",
      "sessions",
    ]);
  });
});
