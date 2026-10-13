import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
const require = createRequire(import.meta.url);
test(
  "packaged UI + SQLite: account and draft survive restart without Facebook requests",
  { timeout: 60000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "mediax-ui-"));
    try {
      for (const phase of ["first", "restart"]) {
        const env = { ...process.env, MEDIAX_USER_DATA: dir };
        delete env.ELECTRON_RUN_AS_NODE;
        delete env.ELECTRON_RENDERER_URL;
        const binary = process.env.MEDIAX_PACKAGED
          ? resolve("dist/mac-arm64/MediaX.app/Contents/MacOS/MediaX")
          : require("electron");
        const child = spawn(
          binary,
          process.env.MEDIAX_PACKAGED ? [] : [resolve("out/main/index.js")],
          { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] },
        );
        let output = "",
          browser;
        const timer = setTimeout(() => child.kill("SIGKILL"), 25000);
        const endpoint = new Promise((resolveEndpoint, reject) => {
          child.stderr.on("data", (b) => {
            output += b;
            const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) resolveEndpoint(match[1]);
          });
          child.once("exit", () => reject(new Error(output)));
          child.once("error", reject);
        });
        try {
          browser = await chromium.connectOverCDP(await endpoint);
          let page;
          for (let i = 0; i < 100; i++) {
            page = browser
              .contexts()
              .flatMap((c) => c.pages())
              .find((p) => p.url().includes("renderer/index.html"));
            if (page) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          assert(page, "Missing app renderer");
          if (phase === "restart") {
            await page.getByRole("tab", { name: "新标签页", exact: true }).waitFor();
            assert.equal(
              await page
                .getByRole("tab", { name: "新标签页", exact: true })
                .getAttribute("aria-selected"),
              "true",
            );
            assert.equal(
              (await page.evaluate(() => window.desktop.workspaceSession())).page,
              "history",
            );
            await page.getByRole("button", { name: "账号管理", exact: true }).click();
          }
          await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
          if (phase === "first") {
            // Keep this persistence test offline; authorization is covered by the UI test.
            await page.evaluate(() => window.desktop.addAccount("UI persistence test"));
            await page.reload();
          }
          await page.getByRole("heading", { name: "UI persistence test" }).waitFor();
          await page.screenshot({
            path: join(tmpdir(), "mediax-accounts.png"),
            animations: "disabled",
          });
          await page.getByRole("button", { name: "内容发布", exact: true }).click();
          await page.getByLabel("发布正文").waitFor();
          if (phase === "first") {
            await page.getByLabel("发布正文").fill("A durable local draft");
            await page.getByRole("button", { name: "保存草稿" }).click();
            await page.getByRole("status").filter({ hasText: "草稿已保存" }).waitFor();
          } else
            assert.equal(await page.getByLabel("发布正文").inputValue(), "A durable local draft");
          assert(await page.getByRole("button", { name: "一键发布", exact: true }).isDisabled());
          await page.getByRole("button", { name: "保存草稿" }).click({ trial: true });
          await page.mouse.move(700, 250);
          await page.getByRole("tooltip").waitFor({ state: "hidden" });
          await page.screenshot({
            path: join(tmpdir(), "mediax-compose.png"),
            animations: "disabled",
          });
          await page.getByRole("button", { name: "发布记录", exact: true }).click();
          await page.getByRole("heading", { name: "发布记录", exact: true }).waitFor();
          await page.mouse.move(700, 250);
          await page.screenshot({
            path: join(tmpdir(), "mediax-history.png"),
            animations: "disabled",
          });
          if (phase === "first") {
            await page.getByRole("button", { name: "新建标签页", exact: true }).click();
            await page.waitForFunction(async () => {
              const saved = await window.desktop.workspaceSession();
              return (
                saved?.tabs.length === 1 &&
                saved.tabs[0].kind === "new" &&
                saved.activeId === saved.tabs[0].id &&
                saved.page === "history"
              );
            });
          }
        } finally {
          if (browser) await browser.close();
          if (child.exitCode === null && child.signalCode === null) {
            const ended = new Promise((r) => child.once("exit", r));
            child.kill("SIGTERM");
            await ended;
          }
          clearTimeout(timer);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
