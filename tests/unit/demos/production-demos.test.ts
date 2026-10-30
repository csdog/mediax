import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNoProductionDemos } from "../../../scripts/check-production-demos.mjs";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "mediax-no-demo-"));
  directories.push(root);
  await mkdir(join(root, "assets"));
  return root;
}
it("accepts a production renderer without demo files or references", async () => {
  const root = await fixture();
  await writeFile(join(root, "assets", "index.js"), 'console.log("MediaX");');
  await expect(assertNoProductionDemos(root)).resolves.toBeUndefined();
});
it.each(["toast-demo.html", "assets/Toast-Demo.js"])(
  "rejects leaked demo file %s",
  async (name) => {
    const root = await fixture();
    await writeFile(join(root, name), "demo");
    await expect(assertNoProductionDemos(root)).rejects.toThrow("Local demo included");
  },
);
it.each([
  "__MEDIAX_LOCAL_TOAST_DEMO__",
  "__MEDIAX_LOCAL_DEMOS__",
  "/demos/index.html",
  "toast-demo.html",
])("rejects a demo reference in an otherwise normal production chunk", async (marker) => {
  const root = await fixture();
  await writeFile(join(root, "assets", "index.js"), JSON.stringify(marker));
  await expect(assertNoProductionDemos(root)).rejects.toThrow("Local demo referenced");
});

it("rejects the standalone demo directory copied into a production build", async () => {
  const root = await fixture();
  await mkdir(join(root, "demos"));
  await writeFile(join(root, "demos", "index.html"), "demo navigation");
  await expect(assertNoProductionDemos(root)).rejects.toThrow("Local demo directory included");
});
