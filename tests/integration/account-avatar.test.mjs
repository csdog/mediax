import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright-core";

const require = createRequire(import.meta.url);
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==";

test("account avatar is downloaded into a local image", { timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "media-post-avatar-"));
  const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const application = await electron.launch({
    executablePath: require("electron"),
    args: [resolve("out/main/index.js")],
    env,
  });
  try {
    const page = await application.firstWindow();
    await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
    const account = await page.evaluate(() =>
      window.desktop.addAccount("Browser tab fixture", "facebook"),
    );
    await application.evaluate(
      async ({ session }, { id, png }) => {
        const partition = session.fromPartition(`persist:facebook-${id}`);
        await partition.cookies.set({
          url: "https://www.facebook.com",
          name: "c_user",
          value: "1001",
        });
        partition.protocol.handle("https", (request) => {
          if (request.url.endsWith("/avatar.png"))
            return new Response(Buffer.from(png, "base64"), {
              headers: { "content-type": "image/png" },
            });
          return new Response(
            '<html><body><button aria-label="Your profile"><img src="/avatar.png" width="32" height="32" alt="avatar"></button></body></html>',
            { headers: { "content-type": "text/html" } },
          );
        });
      },
      { id: account.id, png },
    );
    await page.evaluate((id) => window.desktop.openAccount(id), account.id);
    const saved = (await page.evaluate(() => window.desktop.accounts()))[0].avatar;
    assert.match(saved, /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
    const pixels = Buffer.from(saved.slice("data:image/png;base64,".length), "base64");
    assert.equal(pixels.readUInt32BE(16), 80);
    assert.equal(pixels.readUInt32BE(20), 80);
    await page.reload();
    await page.getByAltText("Browser tab fixture 头像").waitFor();
    assert.equal(await page.getByAltText("Browser tab fixture 头像").getAttribute("src"), saved);
  } finally {
    await application.close();
    await rm(dir, { recursive: true, force: true });
  }
});
