import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": resolve("src/renderer") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/ui/**/*.test.tsx"],
    environment: "node",
    // Transform these ESM modules so Electron mocks also apply to their imports.
    server: { deps: { inline: ["electron-context-menu", "electron-is-dev", "electron-dl"] } },
  },
});
