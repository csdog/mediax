import { app, Notification, shell, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PresentedNotice = {
  channel: "system" | "fallback" | "none";
  detail?: string;
};

function appleScriptString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function showMacScriptNotification(title: string, body: string, silent?: boolean) {
  const sound = silent === true ? "" : ' sound name "Glass"';
  await execFileAsync("osascript", [
    "-e",
    `display notification ${appleScriptString(body)} with title ${appleScriptString(title)}${sound}`,
  ]);
}

function showInAppToast(window: BrowserWindow | null, title: string, body: string) {
  if (!window || window.isDestroyed()) return false;
  window.webContents.send("mediax:command", {
    action: "toast",
    title,
    body,
  });
  return true;
}

function showNativeNotification(options: {
  title: string;
  body: string;
  subtitle?: string;
  silent?: boolean;
  onClick?: () => void;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Notification.isSupported()) return Promise.resolve({ ok: false, error: "unsupported" });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const notification = new Notification({
      title: options.title,
      subtitle: options.subtitle,
      body: options.body,
      silent: options.silent === true,
    });
    notification.once("failed", (_event, error) => finish({ ok: false, error: error || "failed" }));
    if (options.onClick) notification.once("click", options.onClick);
    notification.show();
    // Native success often has no "show" event on macOS; treat lack of failure as ok.
    setTimeout(() => finish({ ok: true }), 450);
  });
}

/**
 * Electron 42+ UNNotification requires a signed binary. Unsigned / ad-hoc Electron
 * builds fail with UNErrorDomain. Always surface an in-app toast when native fails,
 * because Focus / DND can also swallow osascript banners.
 */
export async function presentNotification(
  window: BrowserWindow | null,
  options: {
    title: string;
    body: string;
    subtitle?: string;
    silent?: boolean;
    onClick?: () => void;
    /** Briefly hide the focused window so macOS can show a banner. */
    yieldFocus?: boolean;
  },
): Promise<PresentedNotice> {
  let restore: (() => void) | null = null;
  if (
    options.yieldFocus &&
    window &&
    !window.isDestroyed() &&
    window.isVisible() &&
    !window.isMinimized()
  ) {
    const target = window;
    restore = () => {
      if (!target.isDestroyed()) {
        target.showInactive();
        target.focus();
      }
    };
    window.hide();
    if (process.platform === "darwin") app.dock?.bounce("informational");
  }

  const native = await showNativeNotification(options);
  if (native.ok) {
    if (restore) setTimeout(restore, 2800);
    return { channel: "system" };
  }

  restore?.();
  if (options.silent !== true) shell.beep();

  let scriptOk = false;
  if (process.platform === "darwin") {
    try {
      await showMacScriptNotification(options.title, options.body, options.silent);
      scriptOk = true;
    } catch (error) {
      console.warn("osascript notification failed", error);
    }
  }

  const inApp = showInAppToast(window, options.title, options.body);
  if (inApp || scriptOk) {
    return {
      channel: "fallback",
      detail: inApp
        ? "系统横幅在开发版/未签名时不可用（或被专注模式拦截）；已在应用右上角显示提示。"
        : "当前应用未签名，已尝试 macOS 脚本通知；若仍无横幅，请关闭专注模式并查看通知中心。",
    };
  }

  return { channel: "none", detail: native.error };
}
