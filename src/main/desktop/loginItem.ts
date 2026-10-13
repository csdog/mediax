import { app } from "electron";
import { resolve } from "node:path";

export type OpenAtLoginStatus = {
  openAtLogin: boolean;
  /** Present when the toggle may behave differently from a packaged install. */
  detail: string | null;
};

function loginItemLookup() {
  if (app.isPackaged) return {};
  return {
    path: process.execPath,
    args: process.defaultApp && process.argv[1] ? [resolve(process.argv[1])] : [],
  };
}

export function getOpenAtLogin(): OpenAtLoginStatus {
  const settings = app.getLoginItemSettings(loginItemLookup());
  return {
    openAtLogin: settings.openAtLogin,
    detail: app.isPackaged ? null : "开发模式会注册当前 Electron 进程；正式效果以安装包为准。",
  };
}

export function setOpenAtLogin(openAtLogin: boolean): OpenAtLoginStatus {
  if (typeof openAtLogin !== "boolean") throw new Error("无效登录项设置");
  app.setLoginItemSettings({
    ...loginItemLookup(),
    openAtLogin,
  });
  return getOpenAtLogin();
}

/** Prefer staying in the menu bar / tray when the OS launches us at login. */
export function shouldStartHidden() {
  return app.getLoginItemSettings().wasOpenedAtLogin === true;
}
