import { test } from "node:test";
import assert from "node:assert/strict";
import { _electron as electron } from "playwright-core";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fixture = (
  actor,
  owner = "1001",
  blocked = false,
) => `<!doctype html><html><head><title>Facebook fixture</title><script type="application/json">{"actorID":"${actor}","USER_ID":"${actor}","NAME":"${actor === owner ? "Fixture Person" : "Fixture Page"}"}</script></head><body>
<h1>${actor === owner ? "Fixture Person" : "Fixture Page"}</h1>
${blocked ? '<input name="email"><input name="pass">' : '<button id="compose">What\'s on your mind?</button>'}
<div id="feed"></div>
<script>
let clicks=0;
const posts=JSON.parse(localStorage.getItem('posts:${actor}')||'[]');
function gallery(parent,images){for(const [index,src] of images.slice(0,5).entries()){const tile=document.createElement('div');const i=new Image();i.src=src;i.style.width='120px';tile.append(i);if(index===4&&images.length>5){const more=document.createElement('span');more.textContent='+'+(images.length-4);tile.append(more)}parent.append(tile)}}
function renderPost(body, images, id) {const a=document.createElement('article');a.role='article';a.innerHTML='<h4><a href="https://www.facebook.com/profile.php?id=${actor}">Author</a></h4>';const p=document.createElement('p');p.textContent=body;a.append(p);gallery(a,images);const l=document.createElement('a');l.href='https://www.facebook.com/${actor}/posts/'+id;l.textContent='Just now';a.append(l);document.querySelector('#feed').prepend(a);}
for(const post of posts)renderPost(post.body,post.images,post.id);
document.querySelector('#compose')?.addEventListener('click', () => {
 const d=document.createElement('div'); d.role='dialog';d.innerHTML='<div role="textbox" contenteditable="true"></div><div role="dialog" aria-label="Auxiliary"></div><input type="file" accept="image/*" multiple><div id="attachments"></div><button id="post">Post</button>';const wrapper=document.createElement('div');wrapper.role='dialog';wrapper.append(d);document.body.append(wrapper);
 const attached=[];const post=d.querySelector('#post');
 const editor=d.querySelector('[contenteditable]');editor.addEventListener('input',e=>{if(e.data?.length>1)editor.innerText=''});
 d.querySelector('input').onchange=async e=>{d.querySelector('[contenteditable]').innerText='';post.disabled=true;d.setAttribute('aria-busy','true');for(const file of e.target.files){const i=new Image();i.src=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(file)});i.style.width='120px';i.style.height='120px';await new Promise(r=>{i.onload=r});attached.push(i.src);d.querySelector('#attachments').append(i);}d.querySelector('#attachments').replaceChildren();gallery(d.querySelector('#attachments'),attached);d.removeAttribute('aria-busy');post.disabled=false};
 post.onclick=()=>{clicks++;const body=d.querySelector('[contenteditable]').innerText;const images=attached;const id=posts.length+1;posts.push({body,images,id});localStorage.setItem('posts:${actor}',JSON.stringify(posts));renderPost(body,images,id);wrapper.remove();};
});
window.fixtureClicks=()=>posts.length;
</script></body></html>`;

test(
  "real Electron CDP publishing: profile/Page, snapshot, wrong identity, login pause, unknown verification and no duplicate",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "media-post-publish-"));
    let app;
    try {
      const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.ELECTRON_RENDERER_URL;
      app = await electron.launch({
        executablePath: process.env.MEDIA_POST_PACKAGED
          ? resolve("dist/mac-arm64/media-post.app/Contents/MacOS/media-post")
          : require("electron"),
        args: process.env.MEDIA_POST_PACKAGED ? [] : [resolve("out/main/index.js")],
        env,
      });
      let ui;
      for (let i = 0; i < 100; i++) {
        ui = (await app.windows()).find((p) => p.url().includes("renderer/index.html"));
        if (ui) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert(ui);
      await ui.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
      const a = await ui.evaluate(() => window.desktop.addAccount("Fixture account"));
      const b = await ui.evaluate(() => window.desktop.addAccount("Second account"));
      await app.evaluate(
        async ({ session }, { ids, html }) => {
          for (const id of ids) {
            const s = session.fromPartition(`persist:facebook-${id}`);
            s.protocol.handle(
              "https",
              () => new Response(html, { headers: { "content-type": "text/html" } }),
            );
            await s.cookies.set({
              url: "https://www.facebook.com",
              name: "c_user",
              value: "1001",
              secure: true,
            });
          }
        },
        { ids: [a.id, b.id], html: fixture("1001") },
      );
      await ui.evaluate((id) => window.desktop.openAccount(id), a.id);
      await ui.evaluate(
        (id) => window.desktop.layoutAccountBrowser(id, { x: 300, y: 80, width: 900, height: 600 }),
        a.id,
      );
      const detected = await ui.evaluate((id) => window.desktop.refreshAccount(id), a.id);
      assert.deepEqual(
        detected.targets,
        [{ accountId: a.id, identityId: "1001", name: "Fixture Person", kind: "profile" }],
        detected.message,
      );
      // Capture a Page under the same persistent account, using i_user + loaded actor evidence.
      await app.evaluate(
        async ({ session, webContents }, { id, html }) => {
          const s = session.fromPartition(`persist:facebook-${id}`);
          s.protocol.unhandle("https");
          s.protocol.handle(
            "https",
            () => new Response(html, { headers: { "content-type": "text/html" } }),
          );
          await s.cookies.set({
            url: "https://www.facebook.com",
            name: "i_user",
            value: "2002",
            secure: true,
          });
          const w = webContents.getAllWebContents().find((w) => w.session === s);
          await w.loadURL("https://www.facebook.com/profile.php?id=2002");
        },
        { id: a.id, html: fixture("2002") },
      );
      const pageState = await ui.evaluate((id) => window.desktop.refreshAccount(id), a.id);
      assert.equal(pageState.targets.length, 2, pageState.message);
      const pageTarget = pageState.targets.find((t) => t.kind === "page");
      assert(pageTarget);
      await ui.evaluate((id) => window.desktop.openAccount(id), b.id);
      await ui.evaluate(
        (id) => window.desktop.layoutAccountBrowser(id, { x: 300, y: 80, width: 900, height: 600 }),
        b.id,
      );
      const second = await ui.evaluate((id) => window.desktop.refreshAccount(id), b.id);
      assert.equal(second.targets.length, 1, second.message);
      // Real file dialog + immutable task asset snapshot (source is deleted immediately).
      const image = join(dir, "source.png");
      await writeFile(
        image,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNw6fj/HwAFqgLL87bIIAAAAABJRU5ErkJggg==",
          "base64",
        ),
      );
      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
      }, image);
      const assets = await ui.evaluate(() => window.desktop.chooseImages());
      assert.equal(assets.length, 1);
      await ui.evaluate(
        (id) => window.desktop.layoutAccountBrowser(id, { x: 300, y: 80, width: 900, height: 600 }),
        a.id,
      );
      // Closing a tab must not make an otherwise authorized queued target unusable.
      await ui.evaluate((id) => window.desktop.closeAccountBrowser(id), b.id);
      const taskId = await ui.evaluate(
        ({ path, targets }) =>
          window.desktop.publish(
            "moment",
            null,
            "Fixture publication body",
            Array(11).fill(path),
            targets,
          ),
        { path: image, targets: [pageTarget, second.targets[0]] },
      );
      await rm(image);
      const waitTargets = async (predicate) => {
        for (let i = 0; i < 150; i++) {
          const h = await ui.evaluate(() => window.desktop.history());
          const ts = h.targets.filter((t) => t.taskId === taskId);
          if (predicate(ts)) return { h, ts };
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(JSON.stringify(await ui.evaluate(() => window.desktop.history())));
      };
      const done = await waitTargets(
        (ts) => ts.length === 2 && ts.every((t) => t.status === "verified"),
      );
      assert.deepEqual(
        done.ts.map((t) => t.identityId),
        ["2002", "1001"],
      );
      assert(done.ts.every((t) => t.url?.includes("/posts/1")));
      const task = done.h.tasks.find((t) => t.id === taskId);
      assert.equal(task.images.length, 11);
      assert(task.images.every((p) => p.includes("task-assets")));
      assert((await readFile(task.images[0])).length > 0);
      await assert.rejects(
        ui.evaluate((id) => window.desktop.retry(id), done.ts[0].id),
        /仅明确失败/,
      );
      await app.evaluate(
        async ({ app }, { targetId, packageFile }) => {
          const { createRequire } = process.getBuiltinModule("node:module");
          const DB = createRequire(packageFile)("better-sqlite3");
          const db = new DB(app.getPath("userData") + "/media-post.sqlite");
          db.prepare("UPDATE targets SET status='unknown',url=NULL WHERE id=?").run(targetId);
          db.close();
        },
        { targetId: done.ts[0].id, packageFile: resolve("package.json") },
      );
      await ui.evaluate((id) => window.desktop.verifyTarget(id), done.ts[0].id);
      const checked = (await ui.evaluate(() => window.desktop.history())).targets.find(
        (t) => t.id === done.ts[0].id,
      );
      assert.equal(checked.status, "verified");
      await assert.rejects(
        ui.evaluate(
          ({ id }) =>
            window.desktop.publish(
              "article",
              "标题",
              "bad target",
              [],
              [{ accountId: id, identityId: "9999", name: "forged", kind: "page" }],
            ),
          { id: a.id },
        ),
        /未验证/,
      );
      // Changed actor, same name: refresh must reject instead of accepting Cookie presence.
      await app.evaluate(
        async ({ session, webContents }, { id, html }) => {
          const s = session.fromPartition(`persist:facebook-${id}`);
          s.protocol.unhandle("https");
          s.protocol.handle(
            "https",
            () => new Response(html, { headers: { "content-type": "text/html" } }),
          );
          await webContents
            .getAllWebContents()
            .find((w) => w.session === s)
            .loadURL("https://www.facebook.com/");
        },
        { id: b.id, html: fixture("9999") },
      );
      const mismatch = await ui.evaluate((id) => window.desktop.refreshAccount(id), b.id);
      assert.equal(mismatch.targets.length, 0);
      assert.match(mismatch.message, /无法唯一核验/);
      // Login form despite a stale c_user pauses; no click is made.
      await app.evaluate(
        async ({ session, webContents }, { id, html }) => {
          const s = session.fromPartition(`persist:facebook-${id}`);
          s.protocol.unhandle("https");
          s.protocol.handle(
            "https",
            () => new Response(html, { headers: { "content-type": "text/html" } }),
          );
          await webContents
            .getAllWebContents()
            .find((w) => w.session === s)
            .loadURL("https://www.facebook.com/");
        },
        { id: a.id, html: fixture("2002", "1001", true) },
      );
      const pausedId = await ui.evaluate(
        (t) => window.desktop.publish("article", "暂停", "Pause safely", [], [t]),
        pageTarget,
      );
      let paused;
      for (let i = 0; i < 100; i++) {
        paused = (await ui.evaluate(() => window.desktop.history())).targets.find(
          (t) => t.taskId === pausedId,
        );
        if (paused?.status === "awaiting_user") break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(paused.status, "awaiting_user");
      await app.evaluate(
        async ({ session, webContents }, { id, html }) => {
          const s = session.fromPartition(`persist:facebook-${id}`);
          s.protocol.unhandle("https");
          s.protocol.handle(
            "https",
            () => new Response(html, { headers: { "content-type": "text/html" } }),
          );
          await webContents
            .getAllWebContents()
            .find((w) => w.session === s)
            .loadURL("https://www.facebook.com/");
        },
        { id: a.id, html: fixture("2002") },
      );
      await ui.evaluate((id) => window.desktop.resume(id), paused.id);
      const resumed = (await ui.evaluate(() => window.desktop.history())).targets.find(
        (t) => t.id === paused.id,
      );
      assert.equal(resumed.status, "verified");
      await app
        .evaluate(({ session, webContents }, id) => {
          const s = session.fromPartition(`persist:facebook-${id}`);
          return webContents
            .getAllWebContents()
            .find((w) => w.session === s)
            .executeJavaScript("window.fixtureClicks()");
        }, a.id)
        .then((clicks) => assert.equal(clicks, 2));
    } finally {
      if (app) await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test(
  "identity discovery ignores Create Page and restores the original profile",
  { timeout: 45000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "media-post-identities-"));
    let app;
    try {
      const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.ELECTRON_RENDERER_URL;
      app = await electron.launch({
        executablePath: process.env.MEDIA_POST_PACKAGED
          ? resolve("dist/mac-arm64/media-post.app/Contents/MacOS/media-post")
          : require("electron"),
        args: process.env.MEDIA_POST_PACKAGED ? [] : [resolve("out/main/index.js")],
        env,
      });
      const ui = await app.firstWindow();
      await ui.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
      const account = await ui.evaluate(() => window.desktop.addAccount("Identity discovery"));
      await app.evaluate(async ({ session }, id) => {
        const s = session.fromPartition(`persist:facebook-${id}`);
        await s.cookies.set({
          url: "https://www.facebook.com",
          name: "c_user",
          value: "1001",
          secure: true,
        });
        s.protocol.handle("https", async () => {
          const cookies = await s.cookies.get({ url: "https://www.facebook.com" });
          const actor = cookies.find((c) => c.name === "i_user")?.value || "1001";
          const name = actor === "1001" ? "Fixture Person" : "Fixture Page";
          return new Response(
            `<!doctype html><html><head><script type="application/json">{"actorID":"${actor}","USER_ID":"${actor}","NAME":"${name}"}</script></head><body>
          <button aria-label="Your profile" aria-expanded="false" id="account">Account</button>
          <div role="dialog" aria-label="Your profile" id="menu" hidden>
            <button id="all">See all profiles</button>
          </div>
          <script>
          const menu=document.querySelector('#menu'), account=document.querySelector('#account');
          account.onclick=()=>{menu.hidden=false;account.setAttribute('aria-expanded','true')};
          document.querySelector('#all').onclick=()=>{menu.innerHTML='<h2>Choose profile</h2><ul><li><button data-id="1001" aria-label="Fixture Person, 3 notifications"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">Fixture Person</button></li><li><button data-id="2002" aria-label="Fixture Page, 1 notification"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">Fixture Page</button></li><li><button id="create">Create Page</button></li></ul>';document.querySelector('#create').onclick=()=>{localStorage.setItem('created','yes')};for(const b of document.querySelectorAll('[data-id]'))b.onclick=()=>{document.cookie='i_user='+b.dataset.id+';Path=/;Secure';menu.hidden=true;account.setAttribute('aria-expanded','false')};};
          document.onkeydown=e=>{if(e.key==='Escape'){menu.hidden=true;account.setAttribute('aria-expanded','false')}};
          </script></body></html>`,
            { headers: { "content-type": "text/html" } },
          );
        });
      }, account.id);
      await ui.evaluate((id) => window.desktop.openAccount(id), account.id);
      const result = await ui.evaluate((id) => window.desktop.refreshAccount(id), account.id);
      assert.equal(result.targets.length, 2, result.message);
      assert.deepEqual(
        result.targets.map((t) => [t.identityId, t.kind]),
        [
          ["1001", "profile"],
          ["2002", "page"],
        ],
      );
      const state = await app.evaluate(async ({ session, webContents }, id) => {
        const s = session.fromPartition(`persist:facebook-${id}`);
        const cookies = await s.cookies.get({ url: "https://www.facebook.com" });
        const view = webContents.getAllWebContents().find((w) => w.session === s);
        return {
          actor: cookies.find((c) => c.name === "i_user")?.value,
          created: await view.executeJavaScript("localStorage.getItem('created')"),
        };
      }, account.id);
      assert.equal(state.actor, "1001");
      assert.equal(state.created, null);
    } finally {
      if (app) await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
