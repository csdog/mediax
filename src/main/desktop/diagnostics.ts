import { app, dialog, Notification, shell, type BrowserWindow } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Database } from "../storage/Database";
import { logFilePath } from "../log-path";
import { readLogConfig } from "../../shared/logging";
import { readNotificationSettings } from "../../shared/notificationSettings";
import { presentNotification } from "./presentNotification";
import { collectStorageUsage } from "./storageUsage";
import type { StorageUsage } from "../../shared/storageUsage";

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
  storage: StorageUsage;
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
  const [logTail, storage] = await Promise.all([readLogTail(logFile), collectStorageUsage(false)]);
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
    storage,
    logTail,
  };
}

export function formatDiagnosticReport(report: DiagnosticReport) {
  return [
    "MediaX diagnostic report",
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
    "[storage]",
    `totalBytes: ${report.storage.totalBytes}`,
    ...report.storage.categories.map((item) => `${item.id}: ${item.bytes}`),
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
      `mediax-diagnostics-${report.generatedAt.slice(0, 10)}.txt`,
    ),
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await mkdir(dirname(result.filePath), { recursive: true });
  await writeFile(result.filePath, formatDiagnosticReport(report), "utf8");
  shell.showItemInFolder(result.filePath);
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

export async function sendTestNotification(
  window: BrowserWindow,
  getSetting: (key: string) => unknown,
): Promise<{ ok: boolean; message: string }> {
  const prefs = readNotificationSettings(getSetting);
  if (!prefs.enabled) return { ok: false, message: "已关闭通知总开关，请先开启后再试。" };
  const presented = await presentNotification(window, {
    title: "MediaX 测试通知",
    subtitle: "系统通知通道",
    body: "这是一条测试通知。看到横幅即表示通知通道可用。",
    silent: !prefs.sound,
    yieldFocus: true,
  });
  if (presented.channel === "system")
    return { ok: true, message: "已发送系统通知横幅，请查看屏幕角落。" };
  if (presented.channel === "fallback")
    return { ok: true, message: presented.detail ?? "已通过备用通道发送通知。" };
  return { ok: false, message: presented.detail ?? "未能显示通知。" };
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
      label: app.isPackaged ? "由系统控制" : "开发版受限",
      detail: app.isPackaged
        ? "请在「系统设置 → 通知」中确认 MediaX 已开启通知，样式选「横幅」。未签名包可能无法显示系统横幅。"
        : "Electron 42+ 需要代码签名才能发系统横幅。开发版会改用 macOS 脚本通知作为备用。",
    };
  if (process.platform === "win32")
    return {
      supported: true,
      label: "由系统控制",
      detail: "请在 Windows「设置 → 系统 → 通知」中确认 MediaX 的权限。",
    };
  return {
    supported: true,
    label: "由系统控制",
    detail: "桌面通知权限由操作系统管理。",
  };
}
