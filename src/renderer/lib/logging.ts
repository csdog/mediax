import log from "electron-log/renderer";
import { formatConsoleData, logLevelSchema } from "../../shared/logging";

export function initializeRendererLogging() {
  // Tests and a standalone web preview do not have the Electron preload bridge.
  if (!window.__electronLog) return;
  log.transports.console.format = ({ data, level, message }) =>
    formatConsoleData(
      message.date ?? new Date(),
      level,
      String(message.variables?.processType ?? "renderer"),
      data,
    );
  log.transports.console.level = logLevelSchema
    .default(import.meta.env.DEV ? "debug" : "info")
    .parse(import.meta.env.VITE_LOG_CONSOLE_LEVEL);
  Object.assign(console, log.functions);
  log.errorHandler.startCatching({ showDialog: false });
  log.info("Application renderer ready", { mode: import.meta.env.MODE });
}
