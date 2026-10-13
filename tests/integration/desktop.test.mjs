import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright-core";
const require = createRequire(import.meta.url);

test(
  "desktop: hide/reopen, native menus, single instance, draft command and window restoration",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "media-post-desktop-"));
    const env = { ...process.env, MEDIA_POST_USER_DATA: dir };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_RENDERER_URL;
    const executablePath = process.env.MEDIA_POST_PACKAGED
      ? resolve("dist/mac-arm64/media-post.app/Contents/MacOS/media-post")
      : require("electron");
    const args = process.env.MEDIA_POST_PACKAGED ? [] : [resolve("out/main/index.js")];
    let application;
    try {
      application = await electron.launch({ executablePath, args, env });
      let page = await application.firstWindow();
      await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
      assert.equal(
        (await page.evaluate(() => window.desktop.shortcutSettings())).accelerator,
        "Command+M",
      );
      // Native focus belongs to BrowserWindow, not the DOM (account WebContentsViews can own focus).
      const focusedBackdrop = await application.evaluate(async ({ BrowserWindow, nativeTheme }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.show();
        window.focus();
        for (let attempt = 0; attempt < 100 && !window.isFocused(); attempt++)
          await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          focused: window.isFocused(),
          color: window.getBackgroundColor().toLowerCase(),
          reduced: nativeTheme.prefersReducedTransparency,
          theme: nativeTheme.themeSource,
        };
      });
      assert.equal(focusedBackdrop.theme, "light");
      if (process.platform === "darwin") {
        assert.equal(focusedBackdrop.focused, true);
        // Electron getBackgroundColor reports RGB and omits the alpha channel.
        assert.equal(focusedBackdrop.color, focusedBackdrop.reduced ? "#f9f9f9" : "#000000");
        const inactiveBackdrop = await application.evaluate(async ({ BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0];
          window.blur();
          for (
            let attempt = 0;
            attempt < 100 &&
            (window.isFocused() || window.getBackgroundColor().toLowerCase() !== "#f9f9f9");
            attempt++
          )
            await new Promise((resolve) => setTimeout(resolve, 20));
          return { focused: window.isFocused(), color: window.getBackgroundColor().toLowerCase() };
        });
        assert.deepEqual(inactiveBackdrop, { focused: false, color: "#f9f9f9" });
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
      }
      const frame = await page.evaluate(() => {
        const root = document.documentElement;
        const main = document.querySelector('[data-slot="sidebar-inset"]');
        const bounds = main.getBoundingClientRect();
        const before = getComputedStyle(document.querySelector(".workspace"), "::before");
        const mainStyle = getComputedStyle(main);
        const actualPlatform = root.dataset.desktopPlatform;
        root.dataset.desktopPlatform = "win32";
        const fallback = getComputedStyle(root).backgroundColor;
        root.dataset.desktopPlatform = actualPlatform;
        return {
          platform: actualPlatform,
          fallback,
          right: innerWidth - bounds.right,
          bottom: innerHeight - bounds.bottom,
          paneBackground: mainStyle.backgroundColor,
          radius: mainStyle.borderTopRightRadius,
          surface: before.backgroundColor,
          toolbarDrag: getComputedStyle(document.querySelector(".app-toolbar")).webkitAppRegion,
          tabStripDrag: getComputedStyle(document.querySelector(".tab-strip")).webkitAppRegion,
        };
      });
      assert.equal(frame.platform, process.platform);
      assert.equal(frame.fallback, "rgb(249, 249, 249)");
      assert.equal(frame.right, 8);
      assert.equal(frame.bottom, 8);
      assert.equal(frame.paneBackground, "rgb(255, 255, 255)");
      assert.equal(frame.radius, "16px");
      assert.equal(frame.surface, "rgba(249, 249, 249, 0.85)");
      assert.equal(frame.toolbarDrag, "drag");
      assert.notEqual(frame.tabStripDrag, "no-drag");
      const account = await page.evaluate(() => window.desktop.addAccount("Browser tab fixture"));
      await application.evaluate(async ({ session }, id) => {
        const s = session.fromPartition(`persist:facebook-${id}`);
        await s.cookies.set({ url: "https://www.facebook.com", name: "c_user", value: "1001" });
        s.protocol.handle("https", (request) => {
          if (request.url.endsWith("/avatar.png"))
            return new Response(
              Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
                "base64",
              ),
              { headers: { "content-type": "image/png" } },
            );
          return new Response(
            '<html><body><h1>Local account browser fixture</h1><button aria-label="Your profile"><img src="/avatar.png" width="32" height="32"></button></body></html>',
            { headers: { "content-type": "text/html" } },
          );
        });
      }, account.id);
      await page.reload();
      await page.getByRole("button", { name: "打开浏览器", exact: true }).click();
      await page.getByRole("tab", { name: "Browser tab fixture" }).waitFor();
      const browserState = await application.evaluate(async ({ BrowserWindow, session }, id) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const windows = BrowserWindow.getAllWindows();
          const view = windows[0].contentView.children.find(
            (v) =>
              "webContents" in v &&
              v.webContents.session === session.fromPartition(`persist:facebook-${id}`),
          );
          if (
            view &&
            view.webContents.getURL().includes("facebook.com") &&
            !view.webContents.isLoading()
          )
            return {
              windows: windows.length,
              bounds: view.getBounds(),
              visible: view.getVisible(),
              sandbox: view.webContents.getLastWebPreferences().sandbox,
              body: await view.webContents.executeJavaScript("document.body.innerText"),
              capture: (await view.webContents.capturePage()).toDataURL(),
            };
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(
          "Account browser tab did not load: " +
            JSON.stringify(
              BrowserWindow.getAllWindows()[0].contentView.children.map((v) => ({
                bounds: v.getBounds(),
                url: "webContents" in v ? v.webContents.getURL() : null,
              })),
            ),
        );
      }, account.id);
      await page.waitForFunction(async () =>
        (await window.desktop.accounts())[0].avatar?.startsWith("data:image/png;base64,"),
      );
      const savedAvatar = (await page.evaluate(() => window.desktop.accounts()))[0].avatar;
      await page.getByRole("button", { name: "账号管理", exact: true }).click();
      await page.getByAltText("Browser tab fixture 头像").waitFor();
      assert.equal(
        await page.getByAltText("Browser tab fixture 头像").getAttribute("src"),
        savedAvatar,
      );
      await page.getByRole("button", { name: "打开浏览器", exact: true }).click();
      await page.getByRole("tab", { name: "Browser tab fixture" }).hover();
      const thumbnail = page.getByAltText("Browser tab fixture 页面缩略图");
      await thumbnail.waitFor();
      assert((await thumbnail.getAttribute("src")).startsWith("data:image/png;base64,"));
      const previewBox = await page.getByLabel("Browser tab fixture 页面预览").boundingBox();
      assert(previewBox);
      await application.evaluate(
        async ({ BrowserWindow, session }, { id, box }) => {
          for (let attempt = 0; attempt < 50; attempt++) {
            const windows = BrowserWindow.getAllWindows();
            const host = windows.find((item) =>
              item.contentView.children.some(
                (child) =>
                  "webContents" in child &&
                  child.webContents.session === session.fromPartition(`persist:facebook-${id}`),
              ),
            );
            const view = host?.contentView.children.find(
              (child) =>
                "webContents" in child &&
                child.webContents.session === session.fromPartition(`persist:facebook-${id}`),
            );
            const overlay = windows.find((item) => item !== host && item.isVisible());
            const content = host?.getContentBounds();
            const overlayBounds = overlay?.getBounds();
            const viewBounds = view?.getBounds();
            if (
              view?.getVisible() &&
              viewBounds &&
              content &&
              overlayBounds &&
              viewBounds.y < box.y + box.height - 24 &&
              Math.abs(overlayBounds.x - (content.x + box.x)) <= 8 &&
              Math.abs(overlayBounds.y - (content.y + box.y)) <= 8 &&
              Math.abs(overlayBounds.width - box.width) <= 8 &&
              Math.abs(overlayBounds.height - box.height) <= 8
            )
              return;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          throw new Error("Tab preview does not float above the account page");
        },
        { id: account.id, box: previewBox },
      );
      await page.screenshot({
        path: join(tmpdir(), "media-post-tab-hover.png"),
        animations: "disabled",
      });
      await page.mouse.move(20, 100);
      await thumbnail.waitFor({ state: "hidden" });
      const capture = await application.evaluate(async ({ BrowserWindow }) =>
        (await BrowserWindow.getAllWindows()[0].capturePage()).toDataURL(),
      );
      await writeFile(
        join(tmpdir(), "media-post-browser-tab.png"),
        Buffer.from(capture.split(",")[1], "base64"),
      );
      assert.equal(browserState.body, "Local account browser fixture");
      await writeFile(
        join(tmpdir(), "media-post-browser-content.png"),
        Buffer.from(browserState.capture.split(",")[1], "base64"),
      );
      assert.equal(browserState.windows, 1);
      assert.equal(browserState.visible, true);
      assert.equal(browserState.sandbox, true);
      assert(
        browserState.bounds.y >= 44 &&
          browserState.bounds.width > 0 &&
          browserState.bounds.height > 0,
      );
      await page.getByRole("button", { name: "新建标签页", exact: true }).click();
      await page.getByRole("heading", { name: "新标签页", exact: true }).waitFor();
      assert.equal(await page.getByRole("dialog", { name: "新建标签页" }).count(), 0);
      await page.getByRole("button", { name: "Browser tab fixture", exact: true }).click();
      assert.equal(await page.getByRole("tab", { name: "新标签页", exact: true }).count(), 0);
      assert.equal(await page.getByRole("tab", { name: "Browser tab fixture" }).count(), 1);
      await page.getByRole("tab", { name: "账号管理", exact: true }).click();
      await page.getByRole("button", { name: "打开浏览器", exact: true }).click();
      assert.equal(await page.getByRole("tab", { name: "Browser tab fixture" }).count(), 1);
      await page.getByRole("button", { name: "打开头像菜单" }).click();
      await page.getByRole("dialog", { name: "用户菜单" }).waitFor();
      assert.equal(
        await application.evaluate(
          ({ BrowserWindow, session }, id) =>
            BrowserWindow.getAllWindows()[0]
              .contentView.children.find(
                (v) =>
                  "webContents" in v &&
                  v.webContents.session === session.fromPartition(`persist:facebook-${id}`),
              )
              .getVisible(),
          account.id,
        ),
        true,
      );
      await page.getByRole("button", { name: "打开头像菜单" }).click();
      await page.getByRole("button", { name: "切换侧栏", exact: true }).click();
      await page.getByRole("button", { name: "打开头像菜单" }).click();
      const userMenu = page.getByRole("dialog", { name: "用户菜单" });
      await userMenu.waitFor();
      await page.waitForFunction(() => {
        const menu = document.querySelector("[data-avatar-menu]");
        const pane = document.querySelector(".account-browser-pane");
        return (
          menu && pane && menu.getBoundingClientRect().right <= pane.getBoundingClientRect().left
        );
      });
      assert.equal(
        await application.evaluate(
          ({ BrowserWindow, session }, id) =>
            BrowserWindow.getAllWindows()[0]
              .contentView.children.find(
                (v) =>
                  "webContents" in v &&
                  v.webContents.session === session.fromPartition(`persist:facebook-${id}`),
              )
              .getVisible(),
          account.id,
        ),
        true,
      );
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("main", { name: "设置页面" }).waitFor();
      assert.equal(await page.getByRole("dialog", { name: "设置", exact: true }).count(), 0);
      await application.evaluate(async ({ BrowserWindow, session }, id) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
            (v) =>
              "webContents" in v &&
              v.webContents.session === session.fromPartition(`persist:facebook-${id}`),
          );
          if (!view.getVisible()) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error("Browser view still covers settings");
      }, account.id);
      const shortcutInput = page.getByLabel("全局呼出快捷键");
      await shortcutInput.click();
      await shortcutInput.press("Control+Alt+F11");
      await page.getByRole("button", { name: "保存设置" }).click();
      await page.getByRole("status").filter({ hasText: "已保存，可在其他应用中" }).waitFor();
      assert.equal(
        await application.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered("Control+Alt+F11"),
        ),
        true,
      );
      await page.getByRole("button", { name: "返回工作区", exact: true }).click();
      const occupied = await application.evaluate(({ globalShortcut }) =>
        globalShortcut.register("Control+Alt+F12", () => {}),
      );
      assert.equal(occupied, true);
      await page.evaluate(async () => {
        try {
          await window.desktop.setGlobalShortcut("Control+Alt+F12");
          throw new Error("Expected occupied shortcut to fail");
        } catch (error) {
          if (!String(error).includes("快捷键已被占用")) throw error;
        }
      });
      assert.equal(
        (await page.evaluate(() => window.desktop.shortcutSettings())).accelerator,
        "Control+Alt+F11",
      );
      await application.evaluate(({ globalShortcut }) =>
        globalShortcut.unregister("Control+Alt+F12"),
      );
      // Control+W must be routed even when the native account view owns focus.
      await application.evaluate(({ BrowserWindow, session }, id) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.show();
        window.focus();
        const view = window.contentView.children.find(
          (v) =>
            "webContents" in v &&
            v.webContents.session === session.fromPartition(`persist:facebook-${id}`),
        );
        view.webContents.focus();
        view.webContents.sendInputEvent({ type: "keyDown", keyCode: "W", modifiers: ["control"] });
        view.webContents.sendInputEvent({ type: "keyUp", keyCode: "W", modifiers: ["control"] });
      }, account.id);
      await page.getByRole("tab", { name: "Browser tab fixture" }).waitFor({ state: "detached" });
      await page.getByRole("heading", { name: "账号管理", exact: true }).waitFor();
      assert.equal((await page.evaluate(() => window.desktop.accounts())).length, 1);
      const hidden = await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setBounds({ x: 120, y: 100, width: 1100, height: 740 });
        window.close();
        return { destroyed: window.isDestroyed(), visible: window.isVisible() };
      });
      assert.deepEqual(hidden, { destroyed: false, visible: false });
      const second = spawn(executablePath, args, { env, stdio: "ignore" });
      const timer = setTimeout(() => second.kill("SIGKILL"), 10000);
      const exit = await new Promise((done, reject) => {
        second.once("exit", done);
        second.once("error", reject);
      });
      clearTimeout(timer);
      assert.equal(exit, 0, "second instance should exit");
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
        true,
      );
      const menu = await application.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        const item = menu.getMenuItemById("desktop.compose");
        item.click();
        return menu.getMenuItemById("desktop.save").accelerator;
      });
      assert.equal(menu, "CmdOrCtrl+S");
      await page.getByLabel("发布正文").fill("Saved from the native application menu");
      await application.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("desktop.save").click(),
      );
      await page.getByRole("status").filter({ hasText: "草稿已保存" }).waitFor();
      await application.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("desktop.history").click(),
      );
      await page.getByRole("heading", { name: "发布记录", exact: true }).waitFor();
      await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window.isMaximized()) {
          await new Promise((resolve) => {
            window.once("maximize", resolve);
            window.maximize();
          });
        }
      });
      await application.close();
      application = undefined;
      application = await electron.launch({ executablePath, args, env });
      page = await application.firstWindow();
      await page.getByRole("heading", { name: "发布记录", exact: true }).waitFor();
      assert.equal((await page.evaluate(() => window.desktop.workspaceSession())).page, "history");
      assert.equal(
        (await page.evaluate(() => window.desktop.accounts()))[0].avatar,
        savedAvatar,
        "account avatar survives restart",
      );
      assert.deepEqual(await page.evaluate(() => window.desktop.shortcutSettings()), {
        accelerator: "Control+Alt+F11",
        registered: true,
      });
      assert.equal(
        await application.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered("Control+Alt+F11"),
        ),
        true,
      );
      await page.evaluate(() => window.desktop.setGlobalShortcut(""));
      assert.equal(
        await application.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered("Control+Alt+F11"),
        ),
        false,
      );
      const bounds = await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].getNormalBounds(),
      );
      assert.equal(bounds.width, 1100);
      assert.equal(bounds.height, 740);
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isMaximized(),
        ),
        true,
      );
      await application.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("desktop.compose").click(),
      );
      await page.getByLabel("发布正文").waitFor();
      assert.equal(
        await page.getByLabel("发布正文").inputValue(),
        "Saved from the native application menu",
      );
      await application.evaluate(({ BrowserWindow, Menu }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.close();
        Menu.getApplicationMenu().getMenuItemById("desktop.show").click();
      });
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
        true,
      );
    } finally {
      if (application) await application.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
