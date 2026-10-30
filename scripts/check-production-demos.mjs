import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function assertNoProductionDemos(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "demos")
        throw new Error(`Local demo directory included in production build: ${path}`);
      await assertNoProductionDemos(path);
    } else {
      if (/toast-demo/i.test(entry.name))
        throw new Error(`Local demo included in production build: ${path}`);
      if (/\.(?:html|js|css|map)$/.test(entry.name)) {
        const content = await readFile(path, "utf8");
        if (
          content.includes("__MEDIAX_LOCAL_") ||
          content.includes("/demos/") ||
          content.includes("toast-demo.html")
        )
          throw new Error(`Local demo referenced by production build: ${path}`);
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await assertNoProductionDemos(resolve("out/renderer"));
  console.log("Production build verified: local demo pages are excluded.");
}
