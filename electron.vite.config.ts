import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    server: { host: "127.0.0.1", port: 5186, strictPort: true },
    resolve: { alias: { "@": resolve("src/renderer") } },
    plugins: [tailwindcss()],
    root: "src/renderer",
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
