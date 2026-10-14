import { describe, expect, it } from "vitest";
import { createControlApp } from "../../src/main/control/createApp";

describe("control API app", () => {
  const app = createControlApp({ token: "test-token", version: "0.2.0" });

  it("requires bearer token for /health", async () => {
    const unauth = await app.request("/health");
    expect(unauth.status).toBe(401);

    const wrong = await app.request("/health", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(wrong.status).toBe(401);
  });

  it("returns health payload with valid token", async () => {
    const res = await app.request("/health", {
      headers: { Authorization: "Bearer test-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: "0.2.0" });
  });

  it("exposes OpenAPI at /doc without auth", async () => {
    const res = await app.request("/doc");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      paths?: Record<string, unknown>;
      components?: { securitySchemes?: Record<string, unknown> };
    };
    expect(doc.paths?.["/health"]).toBeTruthy();
    expect(doc.components?.securitySchemes?.bearerAuth).toBeTruthy();
  });
});
