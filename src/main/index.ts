import { app, BrowserWindow } from "electron";
import { createServer } from "node:net";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { AccountBrowserManager } from "./browser/AccountBrowserManager";
import { Database } from "./storage/Database";
import { AccountService } from "./accounts/AccountService";
import { registerIpc } from "./ipc";
import { CdpBridge } from "./browser/CdpBridge";

app.setName("media-post");

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
    const fixtureDb = new Database(join(app.getPath("userData"), "fixture.sqlite"));
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
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 17 },
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, "../preload/index.js"),
    },
  });
  const db = new Database(join(app.getPath("userData"), "media-post.sqlite"));
  db.recover();
  registerIpc(db, new AccountService(db, new AccountBrowserManager()), win);
  app.on("will-quit", () => db.close());
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await win.loadFile(join(__dirname, "../renderer/index.html"));
}
start().catch(async (error) => {
  console.error(error);
  if (process.env.MEDIA_POST_RESULT)
    await writeFile(
      process.env.MEDIA_POST_RESULT,
      JSON.stringify({ ok: false, error: String(error) }),
    );
  app.exit(1);
});
app.on("window-all-closed", () => app.quit());
