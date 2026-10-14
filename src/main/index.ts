import { app, BrowserWindow, Menu, screen } from "electron";
import { initializeLogging, observeWindowLogging, log } from "./logging";
import { createServer } from "node:net";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { productId, productName } from "../shared/product";
import { AccountBrowserManager } from "./browser/AccountBrowserManager";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { registerIpc } from "./ipc";
import { disposeMediaImportHost } from "./content/mediaImportHost";

import { DesktopShell } from "./desktop/DesktopShell";
import { AppUpdater } from "./desktop/AppUpdater";
import { findDeepLinkArg, registerDeepLinkProtocol } from "./desktop/deepLinks";
import { findOpenFileArgs } from "./desktop/openFiles";
import { shouldStartHidden } from "./desktop/loginItem";
import { restoreWindowState } from "./desktop/windowState";
import { installWindowBackdrop } from "./desktop/windowBackdrop";
import { installThemePreference } from "./desktop/themePreference";
import { AppLifecycle } from "./desktop/appLifecycle";
import { invalidateCodeCacheIfNeeded } from "./desktop/codeCache";
import { mark, measure, startupPerfSnapshot } from "./desktop/perfMarks";
import { migrateLegacyUserData } from "./desktop/migrateLegacyPaths";

app.setName(productName);
// Skip Chromium's default menu allocation before we install our own (Electron performance checklist).
Menu.setApplicationMenu(null);

const earlyDeepLinks: string[] = [];
const earlyOpenFiles: string[] = [];
let deepLinkHandler: ((url: string) => void) | null = null;
let openFilesHandler: ((paths: string[]) => void) | null = null;
const enqueueDeepLink = (url: string) => {
  if (deepLinkHandler) deepLinkHandler(url);
  else earlyDeepLinks.push(url);
};
const enqueueOpenFiles = (paths: string[]) => {
  if (!paths.length) return;
  if (openFilesHandler) openFilesHandler(paths);
  else earlyOpenFiles.push(...paths);
};
app.on("open-url", (event, url) => {
  event.preventDefault();
  enqueueDeepLink(url);
});
app.on("open-file", (event, path) => {
  event.preventDefault();
  enqueueOpenFiles([path]);
});
const launchLink = findDeepLinkArg(process.argv);
if (launchLink) earlyDeepLinks.push(launchLink);
enqueueOpenFiles(findOpenFileArgs(process.argv));
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

async function waitForCdp(endpoint: string) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("CDP endpoint unavailable");
}

async function start(): Promise<void> {
  mark("mediax/willStart");
  if (process.env.MEDIAX_USER_DATA) app.setPath("userData", process.env.MEDIAX_USER_DATA);
  else {
    // Keep lowercase data dir even though display name is MediaX.
    app.setPath("userData", join(app.getPath("appData"), productId));
    migrateLegacyUserData();
  }
  initializeLogging();
  if (!app.requestSingleInstanceLock()) {
    log.info("Existing instance detected; handing off");
    // Exit immediately: app.quit() during early init can SIGTRAP on Chrome_IOThread.
    app.exit(0);
    return;
  }
  const port = await unusedPort();
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", String(port));
  await app.whenReady();
  mark("mediax/didReady");
  const endpoint = `http://127.0.0.1:${port}`;
  const cdpReady = waitForCdp(endpoint);
  if (process.env.MEDIAX_FIXTURE) {
    await cdpReady;
    const { CdpBridge } = await import("./browser/CdpBridge");
    const fixtureDb = new Database(
      join(app.getPath("userData"), "fixture.sqlite"),
      join(__dirname, "../../drizzle"),
    );
    if (process.env.MEDIAX_PHASE === "restart" && fixtureDb.accounts().length !== 1)
      throw new Error("SQLite persistence failed");
    if (!fixtureDb.accounts().length) fixtureDb.addAccount("Persistent fixture account");
    fixtureDb.close();
    const manager = new AccountBrowserManager();
    const bridge = new CdpBridge();
    const base = process.env.MEDIAX_FIXTURE;
    const a = await manager.open("fixture-a", `${base}/a`);
    const b = await manager.open("fixture-b", `${base}/b`);
    await bridge.connect(endpoint);
    const pa = await bridge.findPage(`${base}/a`);
    const pb = await bridge.findPage(`${base}/b`);
    const previous = await pa.evaluate(() => localStorage.getItem("owner"));
    if (process.env.MEDIAX_PHASE === "restart" && previous !== "a")
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
      process.env.MEDIAX_RESULT!,
      JSON.stringify({ ok: true, port, versions: process.versions }),
    );
    app.quit();
    return;
  }
  const db = new Database(
    join(app.getPath("userData"), "mediax.sqlite"),
    join(__dirname, "../../drizzle"),
  );
  db.recover();
  await invalidateCodeCacheIfNeeded(db);
  installThemePreference((key) => db.setting(key));
  const lifecycle = new AppLifecycle();
  const { maximized, ...bounds } = restoreWindowState(
    db.setting("mainWindow"),
    [
      screen.getPrimaryDisplay(),
      ...screen.getAllDisplays().filter((d) => d.id !== screen.getPrimaryDisplay().id),
    ].map((d) => d.workArea),
  );
  const startHidden = shouldStartHidden();
  mark("mediax/willCreateWindow");
  const windowIcon = join(
    app.isPackaged ? process.resourcesPath : join(__dirname, "../../build"),
    "icon.png",
  );
  const win = new BrowserWindow({
    ...bounds,
    show: !startHidden,
    minWidth: Math.min(960, bounds.width),
    minHeight: Math.min(640, bounds.height),
    title: "",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 17 },
    backgroundColor: "#f9f9f9",
    icon: windowIcon,
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
      spellcheck: false,
      // VS Code: force V8 code cache instead of Chromium heat heuristics.
      v8CacheOptions: "bypassHeatCheck",
      preload: join(__dirname, "../preload/index.js"),
    },
  });
  mark("mediax/didCreateWindow");
  if (startHidden) log.info("Started hidden after login launch");
  observeWindowLogging(win);
  installWindowBackdrop(win);
  const shell = new DesktopShell(win, db);
  deepLinkHandler = (url) => shell.handleDeepLink(url);
  openFilesHandler = (paths) => shell.handleOpenFiles(paths);
  for (const url of earlyDeepLinks.splice(0)) shell.handleDeepLink(url);
  if (earlyOpenFiles.length) shell.handleOpenFiles(earlyOpenFiles.splice(0));
  const updater = new AppUpdater(win, db);
  const accounts = new AccountService(db, new AccountBrowserManager(win, endpoint));
  accounts.applyBandwidthLimit();
  app.on("will-quit", () => {
    accounts.stopAutoRefresh();
    disposeMediaImportHost();
    void import("./control/ControlServer").then(({ stopControlServer }) =>
      stopControlServer().catch((error) => log.warn("Control API stop failed", error)),
    );
  });
  registerIpc(db, accounts, win, () => shell.rendererReady(), shell, updater);
  if (maximized) win.maximize();
  app.on("will-quit", () => db.close());
  mark("mediax/willLoadWindow");
  const loadPromise = process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(process.env.ELECTRON_RENDERER_URL)
    : win.loadFile(join(__dirname, "../renderer/index.html"));
  // Paint the UI while CDP becomes ready; account publishing still awaits connect later.
  await Promise.all([cdpReady, loadPromise]);
  mark("mediax/didLoadWindow");
  measure("mediax/windowLoad", "mediax/willLoadWindow", "mediax/didLoadWindow");
  measure("mediax/startup", "mediax/willStart", "mediax/didLoadWindow");
  log.info("Application window loaded");
  lifecycle.markRestored();
  // Eventually phase: account sync + updater + Agent control API after first paint settles.
  lifecycle.whenEventually(() => {
    accounts.startAutoRefresh();
    updater.start();
    void import("./control/ControlServer")
      .then(({ startControlServer }) => startControlServer())
      .catch((error) => log.error("Control API failed to start", error));
    log.info("Startup performance marks", { marks: startupPerfSnapshot() });
  });
}
start().catch(async (error) => {
  log.error("Application startup failed", error);
  if (process.env.MEDIAX_RESULT)
    await writeFile(process.env.MEDIAX_RESULT, JSON.stringify({ ok: false, error: String(error) }));
  app.exit(1);
});
// Closing the main window hides it; explicit Quit owns application shutdown.
