import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";

const HealthResponseSchema = z
  .object({
    ok: z.boolean().openapi({ example: true }),
    version: z.string().nullable().optional().openapi({ example: "0.2.0" }),
  })
  .openapi("HealthResponse");

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "healthGet",
  summary: "Control API health",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

export type ControlAppOptions = {
  token: string;
  version: string;
};

/** Loopback Agent control surface: `/health` (auth) + `/doc` (OpenAPI, no auth). */
export function createControlApp(options: ControlAppOptions) {
  const app = new OpenAPIHono();

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "token",
  });

  app.doc("/doc", {
    openapi: "3.0.3",
    info: {
      title: "MediaX Desktop Control API",
      version: "0.0.1",
      description: "Local Agent control API for MediaX desktop (loopback + bearer token).",
    },
  });

  app.use("/health", bearerAuth({ token: options.token }));
  app.openapi(healthRoute, (c) => c.json({ ok: true as const, version: options.version }, 200));

  return app;
}
