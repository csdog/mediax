import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron } from "playwright-core";
const require = createRequire(import.meta.url);

async function waitForLog(file, text) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const content = await readFile(file, "utf8").catch(() => "");
    if (content.includes(text)) return content;
    await delay(50);
  }
  assert.fail(`Missing log entry: ${text}`);
}

test(
  "logging: console/file, renderer errors, rotation and no bridge in remote account sessions",
  { timeout: 60000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "media-post-logging-"));
    const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_RENDERER_URL;
    let application;
    try {
      application = await electron.launch({
        executablePath: process.env.MEDIA_POST_PACKAGED
          ? resolve("dist/mac-arm64/media-post.app/Contents/MacOS/media-post")
          : require("electron"),
        args: process.env.MEDIA_POST_PACKAGED ? [] : [resolve("out/main/index.js")],
        env,
      });
      let output = "";
      application.process().stdout.on("data", (chunk) => {
        output += chunk;
      });
      application.process().stderr.on("data", (chunk) => {
        output += chunk;
      });
      const page = await application.firstWindow();
      await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
      const devtools = [];
      page.on("console", (message) => devtools.push(message.text()));
      const file = join(dir, "logs/main.log");
      await waitForLog(file, "Application renderer ready");
      await application.evaluate(() => {
        console.info("main-console-file-marker");
        console.debug("main-debug-filtered-marker");
        void Promise.reject(new Error("main-unhandled-marker"));
      });
      await page.evaluate(() => {
        console.warn("renderer-console-file-marker");
        console.debug("renderer-debug-filtered-marker");
        window.dispatchEvent(
          new ErrorEvent("error", { error: new Error("renderer-unhandled-marker") }),
        );
      });
      await waitForLog(file, "renderer-console-file-marker");
      await waitForLog(file, "main-unhandled-marker");
      const content = await waitForLog(file, "renderer-unhandled-marker");
      assert.match(content, /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{2}:\d{2}\]/);
      assert.doesNotMatch(content, /\x1b\[/);
      assert.match(content, /mode: 'production'/);
      assert.match(content, /\[INFO\].*\[main\].*main-console-file-marker/);
      assert.match(content, /\[renderer\].*renderer-console-file-marker/);
      assert(!content.includes("debug-filtered-marker"));
      assert.match(
        output,
        /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{2}:\d{2}\] \x1b\[36m\[INFO\] +\x1b\[0m \[main\].*main-console-file-marker/,
      );
      assert(output.includes("renderer-console-file-marker"));
      assert(!output.includes("debug-filtered-marker"));
      assert(devtools.some((text) => text.includes("renderer-console-file-marker")));
      assert(!devtools.some((text) => text.includes("renderer-debug-filtered-marker")));

      const remote = await application.evaluate(async ({ BrowserWindow, WebContentsView }) => {
        const view = new WebContentsView({
          webPreferences: {
            partition: "persist:log-test-remote",
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        BrowserWindow.getAllWindows()[0].contentView.addChildView(view);
        view.setVisible(false);
        await view.webContents.loadURL("data:text/html,<h1>Remote account fixture</h1>");
        const result = await view.webContents.executeJavaScript(
          `({logger: typeof window.__electronLog, desktop: typeof window.desktop})`,
        );
        await view.webContents.executeJavaScript(`console.warn("remote-not-captured-marker")`);
        view.webContents.close();
        return result;
      });
      assert.deepEqual(remote, { logger: "undefined", desktop: "undefined" });
      assert(!(await readFile(file, "utf8")).includes("remote-not-captured-marker"));

      const maxSize = await application.evaluate(({ app }) => {
        const { createRequire } = process.getBuiltinModule("node:module");
        const log = createRequire(app.getAppPath() + "/package.json")("electron-log/main");
        const maxSize = log.transports.file.maxSize;
        const chunk = ".".repeat(Math.min(maxSize, 1024 * 1024));
        for (let i = 0; i < Math.ceil(maxSize / chunk.length) + 2; i++)
          log.processMessage({ level: "info", data: [chunk] }, { transports: ["file"] });
        console.info("after-rotation-marker");
        return maxSize;
      });
      await waitForLog(file, "after-rotation-marker");
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      const archived = join(dir, `logs/main.${stamp}.log`);
      assert((await stat(archived)).size > 0);
      assert((await stat(file)).size < maxSize + 1024 * 1024 + 1024);
    } finally {
      if (application) await application.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
