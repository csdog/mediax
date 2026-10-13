import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ContentKind, ImageAsset, PlatformId, Status, Target } from "../../shared/models";

export type DraftImage = Pick<ImageAsset, "path" | "name">;

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").$type<PlatformId>().notNull().default("facebook"),
});

export const drafts = sqliteTable(
  "drafts",
  {
    id: integer("id").primaryKey(),
    contentKind: text("contentKind").$type<ContentKind>().notNull().default("article"),
    title: text("title"),
    body: text("body").notNull(),
    images: text("images", { mode: "json" }).$type<DraftImage[]>().notNull(),
  },
  (table) => [check("drafts_singleton", sql`${table.id} = 1`)],
);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  contentKind: text("contentKind").$type<ContentKind>().notNull().default("article"),
  title: text("title"),
  body: text("body").notNull(),
  images: text("images", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: text("createdAt").notNull(),
});

export const targets = sqliteTable("targets", {
  id: text("id").primaryKey(),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id),
  accountId: text("accountId")
    .notNull()
    .references(() => accounts.id),
  identityId: text("identityId").notNull(),
  name: text("name").notNull(),
  kind: text("kind").$type<Target["kind"]>().notNull(),
  status: text("status").$type<Status>().notNull(),
  error: text("error"),
  url: text("url"),
});

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  targetId: text("targetId")
    .notNull()
    .references(() => targets.id),
  startedAt: text("startedAt").notNull(),
  status: text("status").$type<Status>().notNull(),
  error: text("error"),
  url: text("url"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  // Parse defensively in Database.setting so corrupt preferences do not prevent startup.
  value: text("value").notNull(),
});
