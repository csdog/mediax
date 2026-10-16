import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { userErrorMessage } from "../../shared/userError";
import { registerBusinessRoutes, type ControlServices } from "./business";

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
  services?: ControlServices;
};

/** Loopback Agent API; business routes and health require auth, OpenAPI is public. */
export function createControlApp(options: ControlAppOptions) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "请求参数无效，请检查内容、目标和时间格式。",
            },
          },
          400,
        );
    },
  });
  app.use("*", async (c, next) => {
    if (c.req.path === "/doc" && c.req.method === "GET") return next();
    return bearerAuth({ token: options.token })(c, next);
  });
  app.use(
    "*",
    bodyLimit({
      maxSize: 1_048_576,
      onError: (c) => c.json({ error: { code: "INVALID_REQUEST", message: "请求内容过大" } }, 413),
    }),
  );
  app.onError((error, c) => {
    if (error instanceof HTTPException)
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: error.status === 401 ? "控制面认证失败" : "请求无效",
          },
        },
        error.status,
      );
    const message = userErrorMessage(error);
    const status = message.includes("不存在") ? 404 : message.includes("尚未就绪") ? 503 : 409;
    return c.json(
      {
        error: {
          code: status === 404 ? "NOT_FOUND" : status === 503 ? "NOT_READY" : "OPERATION_FAILED",
          message,
        },
      },
      status,
    );
  });

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

  app.openapi(healthRoute, (c) => c.json({ ok: true as const, version: options.version }, 200));

  registerBusinessRoutes(app, options.services);
  return app;
}
