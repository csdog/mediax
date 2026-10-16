import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { isAbsolute } from "node:path";
import type { AccountService } from "../accounts/AccountService";
import type { Database } from "../storage/Database";
import type { PublishService } from "../publish/PublishService";
import { platforms } from "../../shared/models";
import { supportedKinds } from "../../shared/content";

/** Uses the desktop's existing service instances, including its single publish queue. */
export type ControlServices = {
  accounts: Pick<AccountService, "list" | "refresh">;
  db: Pick<Database, "tasks" | "task" | "targets" | "calendarEntries">;
  publishing: Pick<PublishService, "publish" | "rescheduleTask" | "retry" | "resume" | "verify">;
};
const kind = z.enum(["article", "moment", "video", "audio"]);
const target = z
  .object({
    accountId: z.string().min(1),
    identityId: z.string().regex(/^\d+$/),
    name: z.string(),
    kind: z.enum(["profile", "page"]).openapi("TargetKind"),
  })
  .openapi("PublishTarget");
const taskTarget = target
  .extend({
    id: z.string(),
    taskId: z.string(),
    status: z
      .enum([
        "scheduled",
        "pending",
        "running",
        "awaiting_user",
        "submitted",
        "verified",
        "failed",
        "unknown",
      ])
      .openapi("TargetStatus"),
    error: z.string().nullable(),
    url: z.string().nullable(),
  })
  .openapi("TaskTarget");
const task = z
  .object({
    id: z.string(),
    contentKind: kind,
    title: z.string().nullable(),
    body: z.string(),
    images: z.array(z.string()),
    createdAt: z.string(),
    scheduledAt: z.string().nullable().optional(),
  })
  .openapi("Task");
const account = z
  .object({
    id: z.string(),
    name: z.string(),
    platform: z.enum(platforms),
    login: z.enum(["unchecked", "logged_out", "logged_in", "needs_verification"]),
    targets: z.array(target),
    message: z.string().optional(),
    avatar: z.string().optional(),
    supportedKinds: z.array(kind),
  })
  .openapi("Account");
const detail = z.object({ task, targets: z.array(taskTarget) }).openapi("TaskDetail");
const date = z.iso.datetime({ offset: true });
const idParam = z.object({ id: z.string().min(1).max(200) });
export const publishInput = z
  .object({
    kind,
    title: z.string().nullable().optional(),
    body: z.string().max(500_000).default(""),
    paths: z.array(z.string().refine(isAbsolute, "素材必须使用本机绝对路径")).max(30).default([]),
    targets: z
      .array(target.omit({ name: true }))
      .min(1)
      .max(100),
    scheduledAt: date.nullable().optional(),
  })
  .strict()
  .openapi("PublishInput");
const error = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .openapi("ControlError");
const json = <T extends z.ZodType>(schema: T) => ({
  description: "OK",
  content: { "application/json": { schema } },
});
const errors = {
  400: json(error),
  401: json(error),
  404: json(error),
  409: json(error),
  413: json(error),
  503: json(error),
};
const security = [{ bearerAuth: [] }];

export function registerBusinessRoutes(app: OpenAPIHono, services?: ControlServices) {
  const use = () => {
    if (!services) throw new Error("桌面业务服务尚未就绪");
    return services;
  };
  const describeTask = (id: string) => ({ task: use().db.task(id), targets: use().db.targets(id) });
  const describeAccount = (a: ReturnType<ControlServices["accounts"]["list"]>[number]) => ({
    ...a,
    supportedKinds: supportedKinds(a.platform),
  });
  app.openapi(
    createRoute({
      method: "get",
      path: "/accounts",
      operationId: "accountsList",
      security,
      responses: { 200: json(z.array(account)), ...errors },
    }),
    (c) => c.json(use().accounts.list().map(describeAccount), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/accounts/{id}/refresh",
      operationId: "accountRefresh",
      security,
      request: { params: idParam },
      responses: { 200: json(account), ...errors },
    }),
    async (c) =>
      c.json(describeAccount(await use().accounts.refresh(c.req.valid("param").id)), 200),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/tasks",
      operationId: "tasksList",
      security,
      responses: {
        200: json(z.object({ tasks: z.array(task), targets: z.array(taskTarget) })),
        ...errors,
      },
    }),
    (c) => c.json({ tasks: use().db.tasks(), targets: use().db.targets() }, 200),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/tasks/{id}",
      operationId: "taskGet",
      security,
      request: { params: idParam },
      responses: { 200: json(detail), ...errors },
    }),
    (c) => c.json(describeTask(c.req.valid("param").id), 200),
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/tasks",
      operationId: "taskCreate",
      summary: "Create an immediate or scheduled publish task",
      security,
      request: {
        body: { required: true, content: { "application/json": { schema: publishInput } } },
      },
      responses: { 201: json(detail), ...errors },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const id = await use().publishing.publish(
        input.kind,
        input.title ?? null,
        input.body,
        input.paths,
        input.targets.map((t) => ({ ...t, name: "" })),
        input.scheduledAt,
      );
      return c.json(describeTask(id), 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/tasks/{id}/schedule",
      operationId: "taskReschedule",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: { "application/json": { schema: z.object({ scheduledAt: date }).strict() } },
        },
      },
      responses: { 200: json(detail), ...errors },
    }),
    (c) => {
      const id = c.req.valid("param").id;
      use().publishing.rescheduleTask(id, c.req.valid("json").scheduledAt);
      return c.json(describeTask(id), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/calendar",
      operationId: "calendarList",
      security,
      request: {
        query: z
          .object({ from: date, to: date })
          .refine((q) => Date.parse(q.from) < Date.parse(q.to), "结束时间必须晚于开始时间"),
      },
      responses: {
        200: json(z.array(z.object({ task, targets: z.array(taskTarget), when: z.string() }))),
        ...errors,
      },
    }),
    (c) => {
      const q = c.req.valid("query");
      return c.json(
        use().db.calendarEntries(new Date(q.from).toISOString(), new Date(q.to).toISOString()),
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/targets/{id}/{action}",
      operationId: "targetAction",
      summary: "Retry a failed target, resume after user action, or verify a submitted target",
      security,
      request: { params: idParam.extend({ action: z.enum(["retry", "resume", "verify"]) }) },
      responses: { 200: json(detail), ...errors },
    }),
    async (c) => {
      const { id, action } = c.req.valid("param");
      const t = use()
        .db.targets()
        .find((t) => t.id === id);
      if (!t) return c.json({ error: { code: "NOT_FOUND", message: "发布目标不存在" } }, 404);
      await use().publishing[action](id);
      return c.json(describeTask(t.taskId), 200);
    },
  );
}
