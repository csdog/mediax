import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test(
  "Electron Chromium: target mapping, isolated persistent sessions, upload, reconnect",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "mediax-cdp-"));
    const server = createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end('<textarea></textarea><input type="file">');
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const phase of ["first", "restart"]) {
        const result = join(dir, `${phase}.json`);
        const binary = process.env.MEDIAX_PACKAGED
          ? resolve("dist/mac-arm64/MediaX.app/Contents/MacOS/MediaX")
          : require("electron");
        const args = process.env.MEDIAX_PACKAGED ? [] : [resolve("out/main/index.js")];
        const env = {
          ...process.env,
          MEDIAX_USER_DATA: join(dir, "profile"),
          MEDIAX_FIXTURE: base,
          MEDIAX_RESULT: result,
          MEDIAX_PHASE: phase,
        };
        delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(binary, args, {
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "",
          listenerError;
        child.stderr.on("data", (b) => (output += b));
        child.stdout.on("data", (b) => (output += b));
        const timer = setTimeout(() => child.kill("SIGKILL"), 35000);
        // While the browser is live, verify the listener is not public.
        const observer = setInterval(() => {
          try {
            const lines = execFileSync(
              "/usr/sbin/lsof",
              ["-nP", "-a", "-p", String(child.pid), "-iTCP", "-sTCP:LISTEN"],
              { encoding: "utf8" },
            );
            assert(
              !lines.includes("*:") && !lines.includes("0.0.0.0:") && !lines.includes("[::]:"),
            );
          } catch (error) {
            if (error.code === "ERR_ASSERTION") {
              listenerError = error;
              child.kill();
              output += error.message;
            }
          }
        }, 250);
        const code = await new Promise((r, j) => {
          child.once("error", j);
          child.once("exit", r);
        });
        clearTimeout(timer);
        clearInterval(observer);
        assert.equal(code, 0, output);
        assert.equal(listenerError, undefined, "Non-loopback listener detected");
        const report = JSON.parse(await readFile(result, "utf8"));
        assert.equal(report.ok, true, JSON.stringify(report));
        console.log(
          `${phase}: Electron ${report.versions.electron}, Chromium ${report.versions.chrome}, CDP port ${report.port}`,
        );
      }
    } finally {
      await new Promise((r) => server.close(r));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
