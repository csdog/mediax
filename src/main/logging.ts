import { renameSync } from "node:fs";
import { app, type BrowserWindow } from "electron";
import log from "electron-log/main";
import { formatConsoleData, formatLogPrefix, readLogConfig } from "../shared/logging";
import { archivedLogPath, logFilePath } from "./log-path";

export function initializeLogging() {
  const config = readLogConfig(import.meta.env);
  const file = logFilePath(config.mode, {
    project: app.getAppPath(),
    userData: app.getPath("userData"),
  });
  log.transports.console.level = config.consoleLevel;
  log.transports.console.useStyles = true;
  log.transports.console.format = ({ data, level, message }) =>
    formatConsoleData(
      message.date ?? new Date(),
      level,
      String(message.variables?.processType ?? "main"),
      data,
    );
  log.transports.file.level = config.fileLevel;
  log.transports.file.maxSize = config.maxSize;
  log.transports.file.resolvePathFn = () => file;
  log.transports.file.archiveLogFn = (current) => {
    renameSync(current.toString(), archivedLogPath(current.toString()));
  };
  log.transports.file.format = ({ data, level, message }) => [
    formatLogPrefix(
      message.date ?? new Date(),
      level,
      String(message.variables?.processType ?? "main"),
    ),
    ...data,
  ];
  // Renderer logs use our bundled preload only. Never inject into account sessions.
  log.initialize({ preload: false });
  log.transports.ipc.level = false;
  Object.assign(console, log.functions);
  log.errorHandler.startCatching({ showDialog: false });
  log.info("Application starting", {
    mode: config.mode,
    version: app.getVersion(),
    platform: process.platform,
    consoleLevel: config.consoleLevel,
    fileLevel: config.fileLevel,
    logFile: file,
  });
  app.on("will-quit", () => log.info("Application quitting"));
}

export function observeWindowLogging(window: BrowserWindow) {
  window.on("unresponsive", () => log.warn("Application window unresponsive"));
  window.on("responsive", () => log.info("Application window responsive"));
  window.webContents.on("render-process-gone", (_event, details) =>
    log.error("Application renderer terminated", {
      reason: details.reason,
      exitCode: details.exitCode,
    }),
  );
  window.webContents.on("preload-error", (_event, _path, error) =>
    log.error("Application preload failed", error),
  );
  window.webContents.on("did-fail-load", (_event, code, description, _url, mainFrame) => {
    if (mainFrame) log.error("Application page load failed", { code, description });
  });
}

export { log };
