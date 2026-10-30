import { expect, it } from "vitest";
import {
  DEV_LOGIN_LABEL,
  OPENED_AT_LOGIN_ENV,
  autostartDesktopEntry,
  darwinLaunchAgentPath,
  devAppPath,
  launchAgentPlist,
  launchWorkingDirectory,
  launchedByLogin,
  linuxAutostartPath,
} from "../../../src/main/desktop/loginItemLaunch";

it("resolves electron-vite's relative app argument", () => {
  expect(devAppPath(".", "/work/mediax-desktop")).toBe("/work/mediax-desktop");
  expect(devAppPath("/abs/app", "/ignored")).toBe("/abs/app");
  expect(devAppPath("--inspect", "/work")).toBeNull();
  expect(devAppPath(undefined, "/work")).toBeNull();
});

it("builds a macOS launch agent that opens the project, not the Electron bundle", () => {
  const plist = launchAgentPlist({
    execPath: "/tools/Electron.app/Contents/MacOS/Electron",
    appPath: "/work/mediax-desktop",
    name: "MediaX",
  });
  expect(plist).toContain(`<string>${DEV_LOGIN_LABEL}</string>`);
  expect(plist).toContain("<string>/tools/Electron.app/Contents/MacOS/Electron</string>");
  expect(plist).toContain("<string>/work/mediax-desktop</string>");
  expect(plist).toContain(`<key>${OPENED_AT_LOGIN_ENV}</key>`);
  expect(plist).toContain("<string>1</string>");
  expect(plist).toContain("<key>RunAtLoad</key>\n  <true/>");
  expect(darwinLaunchAgentPath("/Users/me")).toBe(
    `/Users/me/Library/LaunchAgents/${DEV_LOGIN_LABEL}.plist`,
  );
});

it("escapes plist paths and uses the script directory as the working directory", () => {
  const plist = launchAgentPlist({
    execPath: "/tools/Electron & Co",
    appPath: "/work/app/index.js",
    name: "MediaX",
  });
  expect(plist).toContain("<string>/tools/Electron &amp; Co</string>");
  expect(launchWorkingDirectory("/work/app/index.js")).toBe("/work/app");
  expect(plist).toContain("<key>WorkingDirectory</key>\n  <string>/work/app</string>");
});

it("builds a linux autostart entry with the app path quoted", () => {
  const entry = autostartDesktopEntry({
    execPath: "/opt/electron",
    appPath: "/work/my app",
    name: "MediaX",
  });
  expect(entry).toContain(`Exec=env ${OPENED_AT_LOGIN_ENV}=1 "/opt/electron" "/work/my app"`);
  expect(entry).toContain("Path=/work/my app");
  expect(linuxAutostartPath("/home/me")).toBe(
    `/home/me/.config/autostart/${DEV_LOGIN_LABEL}.desktop`,
  );
});

it("treats the login launcher env as a hidden login start", () => {
  expect(launchedByLogin({ [OPENED_AT_LOGIN_ENV]: "1" }, false)).toBe(true);
  expect(launchedByLogin({}, true)).toBe(true);
  expect(launchedByLogin({}, false)).toBe(false);
});
