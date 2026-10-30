import { dirname, join, resolve } from "node:path";

/** LaunchAgent / autostart id. Distinct from the dev Electron bundle. */
export const DEV_LOGIN_LABEL = "local.mediax.desktop.dev";

/** Set on the login launcher so the app can hide without wasOpenedAtLogin. */
export const OPENED_AT_LOGIN_ENV = "MEDIAX_OPENED_AT_LOGIN";

export type DevLaunchSpec = {
  execPath: string;
  appPath: string;
  name: string;
};

/**
 * electron-vite spawns `electron .`. macOS and Linux login items ignore those
 * args and open the Electron bundle itself, which shows "Error launching app".
 */
export function devAppPath(argv1: string | undefined, cwd: string): string | null {
  if (!argv1 || argv1.startsWith("-")) return null;
  return resolve(cwd, argv1);
}

export function launchWorkingDirectory(appPath: string): string {
  return /\.(?:[cm]?js)$/.test(appPath) ? dirname(appPath) : appPath;
}

export function launchedByLogin(env: NodeJS.ProcessEnv, wasOpenedAtLogin: boolean) {
  return env[OPENED_AT_LOGIN_ENV] === "1" || wasOpenedAtLogin;
}

export function darwinLaunchAgentPath(home: string) {
  return join(home, "Library", "LaunchAgents", `${DEV_LOGIN_LABEL}.plist`);
}

export function linuxAutostartPath(home: string) {
  return join(home, ".config", "autostart", `${DEV_LOGIN_LABEL}.desktop`);
}

export function launchAgentPlist(spec: DevLaunchSpec): string {
  const args = [spec.execPath, spec.appPath]
    .map((value) => `    <string>${escapeXml(value)}</string>`)
    .join("\n");
  const cwd = escapeXml(launchWorkingDirectory(spec.appPath));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${DEV_LOGIN_LABEL}</string>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${cwd}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>${OPENED_AT_LOGIN_ENV}</key>
    <string>1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
}

export function autostartDesktopEntry(spec: DevLaunchSpec): string {
  const cwd = launchWorkingDirectory(spec.appPath);
  const exec = [spec.execPath, spec.appPath].map(quoteDesktop).join(" ");
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=${spec.name}
Comment=Start ${spec.name} when you log in
Exec=env ${OPENED_AT_LOGIN_ENV}=1 ${exec}
Path=${cwd}
Terminal=false
X-GNOME-Autostart-enabled=true
`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function quoteDesktop(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
