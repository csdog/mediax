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
    const dir = await mkdtemp(join(tmpdir(), "media-post-ui-"));
    try {
      for (const phase of ["first", "restart"]) {
        const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
        delete env.ELECTRON_RUN_AS_NODE;
        delete env.ELECTRON_RENDERER_URL;
        const binary = process.env.MEDIA_POST_PACKAGED
          ? resolve("dist/mac-arm64/media-post.app/Contents/MacOS/media-post")
          : require("electron");
        const child = spawn(
          binary,
          process.env.MEDIA_POST_PACKAGED ? [] : [resolve("out/main/index.js")],
          { env, stdio: ["ignore", "pipe", "pipe"] },
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
          await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
          if (phase === "first") {
            await page.getByLabel("账号名称").fill("UI persistence test");
            await page.getByRole("button", { name: "添加账号" }).click();
          }
          await page.getByRole("heading", { name: "UI persistence test" }).waitFor();
          await page.getByRole("button", { name: "内容发布", exact: true }).click();
          await page.getByLabel("发布正文").waitFor();
          if (phase === "first") {
            await page.getByLabel("发布正文").fill("A durable local draft");
            await page.getByRole("button", { name: "保存草稿" }).click();
            await page.getByRole("status").filter({ hasText: "草稿已保存" }).waitFor();
          } else
            assert.equal(await page.getByLabel("发布正文").inputValue(), "A durable local draft");
          assert(await page.getByRole("button", { name: "发布", exact: true }).isDisabled());
          await page.mouse.move(800, 90);
          await page.getByRole("tooltip").waitFor({ state: "hidden" });
          await page.screenshot({
            path: join(tmpdir(), "media-post-compose.png"),
          });
        } finally {
          if (browser) await browser.close();
          const ended = new Promise((r) => child.once("exit", r));
          child.kill("SIGTERM");
          await ended;
          clearTimeout(timer);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
