import { expect, it } from "vitest";
import { loadEnv } from "electron-vite";
import { resolve } from "node:path";
import { formatConsoleData, formatLogPrefix, readLogConfig } from "../../src/shared/logging";
import { archivedLogPath, logFilePath } from "../../src/main/log-path";

it("loads the project's shared and mode-specific logging configuration", () => {
  for (const [mode, level] of [
    ["development", "debug"],
    ["production", "info"],
  ]) {
    const config = readLogConfig({ ...loadEnv(mode, resolve(".")), MODE: mode });
    expect(config).toEqual({ mode, consoleLevel: level, fileLevel: level, maxSize: 5242880 });
  }
});

it("puts the local timezone offset in the log timestamp", () => {
  const date = new Date(2026, 9, 13, 9, 35, 1, 7);
  const offset = date.getTimezoneOffset();
  const sign = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  expect(formatLogPrefix(date, "info", "main")).toBe(
    `[2026-10-13 09:35:01.007 ${zone}] [INFO]  [main]`,
  );
  expect(formatLogPrefix(date, "debug", "renderer")).toBe(
    `[2026-10-13 09:35:01.007 ${zone}] [DEBUG] [renderer]`,
  );
  expect(formatConsoleData(date, "info", "main", ["ready"])).toEqual([
    `[2026-10-13 09:35:01.007 ${zone}] %c[INFO] %c [main]`,
    "color:cyan",
    "color:unset",
    "ready",
  ]);
  expect(formatConsoleData(date, "error", "renderer", [])[1]).toBe("color:red");
  expect(formatConsoleData(date, "warn", "main", [])[1]).toBe("color:yellow");
  expect(formatConsoleData(date, "debug", "main", [])[1]).toBe("color:gray");
});

it("writes development logs in the project and production logs in application data", () => {
  expect(logFilePath("development", { project: "/repo", userData: "/app-data" })).toBe(
    "/repo/logs/main.log",
  );
  expect(logFilePath("production", { project: "/repo", userData: "/app-data" })).toBe(
    "/app-data/logs/main.log",
  );
});

it("archives rotated logs with a local date stamp", () => {
  const when = new Date(2026, 9, 13, 18, 18, 0);
  expect(archivedLogPath("/repo/logs/main.log", when, () => false)).toBe(
    "/repo/logs/main.2026-10-13.log",
  );
  expect(
    archivedLogPath("/repo/logs/main.log", when, (path) => path.endsWith("main.2026-10-13.log")),
  ).toBe("/repo/logs/main.2026-10-13.1.log");
});

it("validates log levels and bounded rotation sizes, allowing individual transports to be disabled", () => {
  expect(readLogConfig({ VITE_LOG_CONSOLE_LEVEL: "false" }).consoleLevel).toBe(false);
  expect(readLogConfig({ MAIN_VITE_LOG_FILE_LEVEL: "false" }).fileLevel).toBe(false);
  expect(() => readLogConfig({ MAIN_VITE_LOG_FILE_LEVEL: "trace" })).toThrow();
  for (const value of ["0", "-1", "oops", "1.5", "104857601"])
    expect(() => readLogConfig({ MAIN_VITE_LOG_MAX_SIZE: value })).toThrow();
});
