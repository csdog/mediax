import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/main/storage/schema.ts",
  out: "./drizzle",
  strict: true,
});
