import { app } from "electron";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { productName } from "../../shared/product";
import {
  autostartDesktopEntry,
  darwinLaunchAgentPath,
  devAppPath,
  launchedByLogin,
  launchAgentPlist,
  linuxAutostartPath,
  type DevLaunchSpec,
} from "./loginItemLaunch";

export type OpenAtLoginStatus = {
  openAtLogin: boolean;
  /** Present when login launch differs from a packaged install. */
  detail: string | null;
};

const DEV_DETAIL =
  "系统登录后会打开当前开发工程，不会再弹出 Electron 本体。从登录项启动时默认留在菜单栏。";

/**
 * macOS/Linux `setLoginItemSettings` only registers the running .app and drops
 * `args`. In dev that .app is the Electron binary, so login shows Electron's
 * own "Error launching app" dialog. A LaunchAgent / autostart entry can pass
 * the project path. Windows honors `path` and `args`.
 */
function usesDevLauncher() {
  return !app.isPackaged && (process.platform === "darwin" || process.platform === "linux");
}

function currentDevAppPath() {
  if (!process.defaultApp) return null;
  return devAppPath(process.argv[1], process.cwd());
}

function launcherPath() {
  const home = homedir();
  return process.platform === "darwin" ? darwinLaunchAgentPath(home) : linuxAutostartPath(home);
}

function devLauncherInstalled() {
  return existsSync(launcherPath());
}

function launchSpec(): DevLaunchSpec {
  const appPath = currentDevAppPath();
  if (!appPath) throw new Error("开发模式无法确定应用目录，不能设置登录时启动");
  return { execPath: process.execPath, appPath, name: productName };
}

function installDevLauncher() {
  const spec = launchSpec();
  const file = launcherPath();
  mkdirSync(dirname(file), { recursive: true });
  const body = process.platform === "darwin" ? launchAgentPlist(spec) : autostartDesktopEntry(spec);
  writeFileSync(file, body);
}

function removeDevLauncher() {
  rmSync(launcherPath(), { force: true });
}

/** Drop a previously registered Electron.app login item. */
function clearHostLoginItem() {
  if (app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: false });
  }
}

function windowsLoginQuery() {
  if (process.platform !== "win32" || app.isPackaged) return {};
  const appPath = currentDevAppPath();
  return { path: process.execPath, args: appPath ? [appPath] : [] };
}

export function getOpenAtLogin(): OpenAtLoginStatus {
  if (usesDevLauncher()) {
    return { openAtLogin: devLauncherInstalled(), detail: DEV_DETAIL };
  }
  const settings = app.getLoginItemSettings(windowsLoginQuery());
  return { openAtLogin: settings.openAtLogin, detail: null };
}

export function setOpenAtLogin(openAtLogin: boolean): OpenAtLoginStatus {
  if (typeof openAtLogin !== "boolean") throw new Error("无效登录项设置");
  if (usesDevLauncher()) {
    clearHostLoginItem();
    if (openAtLogin) installDevLauncher();
    else removeDevLauncher();
    return getOpenAtLogin();
  }
  const appPath = currentDevAppPath();
  if (openAtLogin && !app.isPackaged && process.platform === "win32" && !appPath) {
    throw new Error("开发模式无法确定应用目录，不能设置登录时启动");
  }
  app.setLoginItemSettings({ ...windowsLoginQuery(), openAtLogin });
  return getOpenAtLogin();
}

/**
 * Dev sessions that already registered Electron.app keep failing at the next
 * login until that item is replaced. Safe to call on every start.
 */
export function repairOpenAtLogin() {
  if (!usesDevLauncher()) return;
  const hostRegistered = app.getLoginItemSettings().openAtLogin === true;
  if (!hostRegistered && !devLauncherInstalled()) return;
  clearHostLoginItem();
  try {
    installDevLauncher();
  } catch {
    removeDevLauncher();
  }
}

/** Prefer staying in the menu bar / tray when the OS launches us at login. */
export function shouldStartHidden() {
  return launchedByLogin(process.env, app.getLoginItemSettings().wasOpenedAtLogin === true);
}
