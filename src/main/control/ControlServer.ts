import type { ServerType } from "@hono/node-server";
import { app } from "electron";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { log } from "../logging";
import { createControlApp } from "./createApp";
import type { ControlServices } from "./business";
import { controlConfigPath } from "./paths";

export type ControlListenInfo = {
  baseUrl: string;
  configPath: string;
  apiVersion: number;
};

let server: ServerType | null = null;
let writtenConfigPath: string | null = null;

async function unusedLoopbackPort(): Promise<number> {
  const fixed = process.env.MEDIAX_CONTROL_PORT?.trim();
  if (fixed) {
    const port = Number(fixed);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`MEDIAX_CONTROL_PORT is invalid: ${fixed}`);
    }
    return port;
  }
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    probe.close((err) => (err ? reject(err) : resolve())),
  );
  return port;
}

async function writeControlConfig(info: {
  baseUrl: string;
  token: string;
  apiVersion: number;
  configPath: string;
}) {
  await mkdir(dirname(info.configPath), { recursive: true });
  const body = JSON.stringify(
    {
      baseUrl: info.baseUrl,
      token: info.token,
      apiVersion: info.apiVersion,
    },
    null,
    2,
  );
  await writeFile(info.configPath, `${body}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(info.configPath, 0o600);
  } catch {
    // Windows may ignore mode; still usable.
  }
}

/** Start loopback Hono control API and publish `~/.mediax/agent/control.json` for mediax-agent. */
export async function startControlServer(
  services: ControlServices,
): Promise<ControlListenInfo | null> {
  if (process.env.MEDIAX_CONTROL_DISABLE === "1") {
    log.info("Control API disabled via MEDIAX_CONTROL_DISABLE");
    return null;
  }
  if (server) {
    throw new Error("Control API already running");
  }

  const { serve } = await import("@hono/node-server");
  const token = randomBytes(32).toString("base64url");
  const port = await unusedLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const apiVersion = 1;
  const configPath = controlConfigPath();
  const hono = createControlApp({ token, version: app.getVersion(), services });

  await new Promise<void>((resolve, reject) => {
    server = serve(
      {
        fetch: hono.fetch,
        hostname: "127.0.0.1",
        port,
      },
      () => resolve(),
    );
    server.once("error", reject);
  });

  try {
    await writeControlConfig({ baseUrl, token, apiVersion, configPath });
    writtenConfigPath = configPath;
  } catch (error) {
    await stopControlServer();
    throw error;
  }

  log.info("Control API listening", { baseUrl, configPath, apiVersion });
  return { baseUrl, configPath, apiVersion };
}

export async function stopControlServer(): Promise<void> {
  const current = server;
  server = null;
  const path = writtenConfigPath;
  writtenConfigPath = null;

  if (current) {
    await new Promise<void>((resolve) => {
      current.close(() => resolve());
    });
  }

  if (path) {
    try {
      await unlink(path);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? (error as { code: unknown }).code
          : null;
      if (code !== "ENOENT") {
        log.warn("Failed to remove control.json", error);
      }
    }
  }
}
