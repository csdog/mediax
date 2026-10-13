import { defineConfig, externalizeDepsPlugin, loadEnv } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { z } from "zod";

export default defineConfig(({ mode }) => {
  const envDir = resolve(".");
  const env = loadEnv(mode, envDir);
  const port = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(5186)
    .parse(env.MAIN_VITE_DEV_SERVER_PORT);
  return {
    main: { envDir, plugins: [externalizeDepsPlugin()] },
    // Sandboxed preloads cannot require npm packages; bundle the logging bridge.
    preload: { envDir, plugins: [externalizeDepsPlugin({ exclude: ["electron-log"] })] },
    renderer: {
      envDir,
      server: { host: "127.0.0.1", port, strictPort: true },
      resolve: { alias: { "@": resolve("src/renderer") } },
      plugins: [tailwindcss()],
      root: "src/renderer",
      build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
    },
  };
});
