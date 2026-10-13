import { app, BrowserWindow, screen } from "electron";
import { initializeLogging, observeWindowLogging, log } from "./logging";
import { createServer } from "node:net";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { AccountBrowserManager } from "./browser/AccountBrowserManager";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { registerIpc } from "./ipc";
import { CdpBridge } from "./browser/CdpBridge";

import { DesktopShell } from "./desktop/DesktopShell";
import { AppUpdater } from "./desktop/AppUpdater";
import { findDeepLinkArg, registerDeepLinkProtocol } from "./desktop/deepLinks";
import { shouldStartHidden } from "./desktop/loginItem";
import { restoreWindowState } from "./desktop/windowState";
import { installWindowBackdrop } from "./desktop/windowBackdrop";

app.setName("media-post");

const earlyDeepLinks: string[] = [];
let deepLinkHandler: ((url: string) => void) | null = null;
const enqueueDeepLink = (url: string) => {
  if (deepLinkHandler) deepLinkHandler(url);
  else earlyDeepLinks.push(url);
};
app.on("open-url", (event, url) => {
  event.preventDefault();
  enqueueDeepLink(url);
});
const launchLink = findDeepLinkArg(process.argv);
if (launchLink) earlyDeepLinks.push(launchLink);
registerDeepLinkProtocol();

// Configure before ready; port is dynamically reserved, never a public bind.
async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  return port;
}
async function start(): Promise<void> {
  if (process.env.MEDIA_POST_USER_DATA) app.setPath("userData", process.env.MEDIA_POST_USER_DATA);
  initializeLogging();
  if (!app.requestSingleInstanceLock()) {
    log.info("Existing instance detected; handing off");
    app.quit();
    return;
  }
  const port = await unusedPort();
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", String(port));
  await app.whenReady();
  const endpoint = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!ready) throw new Error("CDP endpoint unavailable");
  if (process.env.MEDIA_POST_FIXTURE) {
    const fixtureDb = new Database(
      join(app.getPath("userData"), "fixture.sqlite"),
      join(__dirname, "../../drizzle"),
    );
    if (process.env.MEDIA_POST_PHASE === "restart" && fixtureDb.accounts().length !== 1)
      throw new Error("SQLite persistence failed");
    if (!fixtureDb.accounts().length) fixtureDb.addAccount("Persistent fixture account");
    fixtureDb.close();
    const manager = new AccountBrowserManager();
    const bridge = new CdpBridge();
    const base = process.env.MEDIA_POST_FIXTURE;
    const a = await manager.open("fixture-a", `${base}/a`);
    const b = await manager.open("fixture-b", `${base}/b`);
    await bridge.connect(endpoint);
    const pa = await bridge.findPage(`${base}/a`);
    const pb = await bridge.findPage(`${base}/b`);
    const previous = await pa.evaluate(() => localStorage.getItem("owner"));
    if (process.env.MEDIA_POST_PHASE === "restart" && previous !== "a")
      throw new Error("Session not persistent");
    await pa.evaluate(() => {
      localStorage.setItem("owner", "a");
      document.cookie = "owner=a; path=/";
    });
    await pb.evaluate(() => {
      localStorage.setItem("owner", "b");
      document.cookie = "owner=b; path=/";
    });
    if ((await pa.evaluate(() => localStorage.getItem("owner"))) !== "a")
      throw new Error("Storage crossed partitions");
    if (
      (await pa.evaluate(() => document.cookie)) !== "owner=a" ||
      (await pb.evaluate(() => document.cookie)) !== "owner=b"
    )
      throw new Error("Cookie isolation failed");
    await pa.locator("textarea").fill("Hello from CDP");
    await pb.locator("textarea").fill("Account B");
    await pa.locator("input[type=file]").setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    if ((await pb.locator("textarea").inputValue()) !== "Account B")
      throw new Error("Wrong target");
    if (
      (await pa.locator("input").evaluate((el: HTMLInputElement) => el.files?.[0]?.name)) !==
      "pixel.png"
    )
      throw new Error("Upload failed");
    await a.webContents.session.flushStorageData();
    await b.webContents.session.flushStorageData();
    await a.webContents.session.cookies.flushStore();
    await b.webContents.session.cookies.flushStore();
    // Reconnect and locate the same targets without depending on array positions.
    await bridge.disconnect();
    await bridge.connect(endpoint);
    if (
      (await (await bridge.findPage(`${base}/a`)).locator("textarea").inputValue()) !==
      "Hello from CDP"
    )
      throw new Error("Reconnect mismatch");
    await writeFile(
      process.env.MEDIA_POST_RESULT!,
      JSON.stringify({ ok: true, port, versions: process.versions }),
    );
    app.quit();
    return;
  }
  const db = new Database(
    join(app.getPath("userData"), "media-post.sqlite"),
    join(__dirname, "../../drizzle"),
  );
  db.recover();
  const { maximized, ...bounds } = restoreWindowState(
    db.setting("mainWindow"),
    [
      screen.getPrimaryDisplay(),
      ...screen.getAllDisplays().filter((d) => d.id !== screen.getPrimaryDisplay().id),
    ].map((d) => d.workArea),
  );
  const startHidden = shouldStartHidden();
  const win = new BrowserWindow({
    ...bounds,
    show: !startHidden,
    minWidth: Math.min(960, bounds.width),
    minHeight: Math.min(640, bounds.height),
    title: "",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 17 },
    backgroundColor: "#f9f9f9",
    ...(process.platform === "darwin"
      ? {
          vibrancy: "menu" as const,
          // Focus/blur switches between a native material and an opaque backdrop.
          visualEffectState: "followWindow" as const,
        }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, "../preload/index.js"),
    },
  });
  if (startHidden) log.info("Started hidden after login launch");
  observeWindowLogging(win);
  installWindowBackdrop(win);
  const shell = new DesktopShell(win, db);
  deepLinkHandler = (url) => shell.handleDeepLink(url);
  for (const url of earlyDeepLinks.splice(0)) shell.handleDeepLink(url);
  const updater = new AppUpdater(win, db);
  const accounts = new AccountService(db, new AccountBrowserManager(win, endpoint));
  accounts.startAutoRefresh();
  accounts.applyBandwidthLimit();
  updater.start();
  app.on("will-quit", () => accounts.stopAutoRefresh());
  registerIpc(db, accounts, win, () => shell.rendererReady(), shell, updater);
  if (maximized) win.maximize();
  app.on("will-quit", () => db.close());
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await win.loadFile(join(__dirname, "../renderer/index.html"));
  log.info("Application window loaded");
}
start().catch(async (error) => {
  log.error("Application startup failed", error);
  if (process.env.MEDIA_POST_RESULT)
    await writeFile(
      process.env.MEDIA_POST_RESULT,
      JSON.stringify({ ok: false, error: String(error) }),
    );
  app.exit(1);
});
// Closing the main window hides it; explicit Quit owns application shutdown.
