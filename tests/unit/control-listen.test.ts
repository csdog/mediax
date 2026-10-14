import { afterEach, describe, expect, it } from "vitest";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createControlApp } from "../../src/main/control/createApp";

describe("control API listen (node-server)", () => {
  let server: ServerType | undefined;

  afterEach(async () => {
    if (!server) return;
    const current = server;
    server = undefined;
    await new Promise<void>((resolve) => current.close(() => resolve()));
  });

  it("serves /health over loopback with bearer token", async () => {
    const token = "listen-test-token";
    const app = createControlApp({ token, version: "0.2.0" });
    const port = await new Promise<number>((resolve, reject) => {
      server = serve(
        {
          fetch: app.fetch,
          hostname: "127.0.0.1",
          port: 0,
        },
        (info) => resolve(info.port),
      );
      server.once("error", reject);
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const unauth = await fetch(`${baseUrl}/health`);
    expect(unauth.status).toBe(401);

    const ok = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, version: "0.2.0" });

    const doc = await fetch(`${baseUrl}/doc`);
    expect(doc.status).toBe(200);
    const body = (await doc.json()) as { paths?: Record<string, unknown> };
    expect(body.paths?.["/health"]).toBeTruthy();
  });
});
