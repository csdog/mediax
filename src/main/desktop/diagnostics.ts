import { app, dialog, Notification, shell, type BrowserWindow } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Database } from "../storage/Database";
import { logFilePath } from "../log-path";
import { readLogConfig } from "../../shared/logging";

export type DiagnosticReport = {
  generatedAt: string;
  app: { name: string; version: string; packaged: boolean };
  runtime: {
    electron: string;
    chrome: string;
    node: string;
    platform: NodeJS.Platform;
    arch: string;
  };
  paths: { userData: string; logsDir: string; logFile: string };
  counts: {
    accounts: number;
    tasks: number;
    targets: Record<string, number>;
  };
  logTail: string;
};

export function currentLogFile() {
  const config = readLogConfig(import.meta.env);
  return logFilePath(config.mode, {
    project: app.getAppPath(),
    userData: app.getPath("userData"),
  });
}

export async function readLogTail(path: string, maxBytes = 64_000) {
  try {
    const buffer = await readFile(path);
    const slice =
      buffer.byteLength > maxBytes ? buffer.subarray(buffer.byteLength - maxBytes) : buffer;
    const text = slice.toString("utf8");
    return buffer.byteLength > maxBytes ? `…\n${text}` : text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `（无法读取日志：${message}）`;
  }
}

export async function buildDiagnosticReport(db: Database): Promise<DiagnosticReport> {
  const logFile = currentLogFile();
  const targets = db.targets();
  const byStatus: Record<string, number> = {};
  for (const target of targets) byStatus[target.status] = (byStatus[target.status] ?? 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      packaged: app.isPackaged,
    },
    runtime: {
      electron: process.versions.electron ?? "",
      chrome: process.versions.chrome ?? "",
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    paths: {
      userData: app.getPath("userData"),
      logsDir: dirname(logFile),
      logFile,
    },
    counts: {
      accounts: db.accounts().length,
      tasks: db.tasks().length,
      targets: byStatus,
    },
    logTail: await readLogTail(logFile),
  };
}

export function formatDiagnosticReport(report: DiagnosticReport) {
  return [
    "media-post diagnostic report",
    `generatedAt: ${report.generatedAt}`,
    "",
    "[app]",
    `name: ${report.app.name}`,
    `version: ${report.app.version}`,
    `packaged: ${report.app.packaged}`,
    "",
    "[runtime]",
    `electron: ${report.runtime.electron}`,
    `chrome: ${report.runtime.chrome}`,
    `node: ${report.runtime.node}`,
    `platform: ${report.runtime.platform}`,
    `arch: ${report.runtime.arch}`,
    "",
    "[paths]",
    `userData: ${report.paths.userData}`,
    `logsDir: ${report.paths.logsDir}`,
    `logFile: ${report.paths.logFile}`,
    "",
    "[counts]",
    `accounts: ${report.counts.accounts}`,
    `tasks: ${report.counts.tasks}`,
    `targets: ${JSON.stringify(report.counts.targets)}`,
    "",
    "[logTail]",
    report.logTail,
    "",
  ].join("\n");
}

export async function exportDiagnosticReport(window: BrowserWindow, db: Database) {
  const report = await buildDiagnosticReport(db);
  const result = await dialog.showSaveDialog(window, {
    title: "导出诊断信息",
    defaultPath: join(
      app.getPath("downloads"),
      `media-post-diagnostics-${report.generatedAt.slice(0, 10)}.txt`,
    ),
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await mkdir(dirname(result.filePath), { recursive: true });
  await writeFile(result.filePath, formatDiagnosticReport(report), "utf8");
  return result.filePath;
}

export async function revealLogFile() {
  const file = currentLogFile();
  await mkdir(dirname(file), { recursive: true });
  try {
    await readFile(file);
  } catch {
    await writeFile(file, "", "utf8");
  }
  shell.showItemInFolder(file);
}

export function openNotificationSettings() {
  if (process.platform === "darwin")
    return shell.openExternal("x-apple.systempreferences:com.apple.preference.notifications");
  if (process.platform === "win32") return shell.openExternal("ms-settings:notifications");
  return Promise.resolve();
}

export function notificationPermissionStatus(): {
  supported: boolean;
  label: string;
  detail: string;
} {
  const supported = Notification.isSupported();
  if (!supported)
    return {
      supported: false,
      label: "不支持",
      detail: "当前系统环境无法显示桌面通知。",
    };
  if (process.platform === "darwin")
    return {
      supported: true,
      label: "由系统控制",
      detail: "请在「系统设置 → 通知」中确认 media-post 的权限。",
    };
  if (process.platform === "win32")
    return {
      supported: true,
      label: "由系统控制",
      detail: "请在 Windows「设置 → 系统 → 通知」中确认 media-post 的权限。",
    };
  return {
    supported: true,
    label: "由系统控制",
    detail: "桌面通知权限由操作系统管理。",
  };
}
