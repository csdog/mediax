# AGENTS.md

macOS 本地多平台发布应用。Git 仓库是 `mediax-desktop/`；外层 `mediax/` 只是容器。开发、测试和打包都在本目录执行。

## 命令

完整本地开发 / 测试 / 打包步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。Node 与 pnpm 以 `mise.toml` 为准；`electron` 不在 PATH 上，用 `pnpm run` 或 `pnpm exec`。

```sh
pnpm run dev
pnpm run typecheck
pnpm run test:unit
pnpm run test:ui
pnpm run lint
pnpm run fmt
```

集成 / 打包测试只有用户明确要求时才跑；不要为了验证向真实账号再发一条帖。Dock 名与 `MediaX.app` 重命名细节见 DEVELOPMENT.md。

## 版本与发版

对用户可见的功能、重命名、安装包行为或默认配置有实质变化时，**同一批提交里**要抬 `package.json` 的 `version`（semver：破坏性/大改 → minor 或 major；小修 → patch）。不要只推代码、事后再补版本。

### 走 PR，再打 tag

GitHub Release 的自动 **What's Changed** 只汇总**合并进默认分支的 PR**，不列出直推 `main` 的 commit。因此：

1. 在功能分支上开发并提交（含需要的 version bump）。
2. 开 PR → 审查 → **merge 进 `main`**（不要把发版相关改动只直推 `main`）。
3. 在已合并的 `main` 上打并推送 `v*` 标签（与 `package.json` 一致，如 `v0.2.0`），触发 GitHub Actions 打安装包并发 Release。

仅 `git push` 主分支不会发版；仅打 tag 但中间没有合并 PR 时，Release 往往只有 Full Changelog 链接、没有 What's Changed。用户要求「提交并推送」且属于发版范围时：默认走 PR 合并后再打 tag；用户明确说「直推 / 不要 PR」时才直推，并自行写清 release 正文（或接受无 What's Changed）。

显示名是 **MediaX**；协议、包名、数据目录等标识符用小写 `mediax`（见 `src/shared/product.ts`）。

## 代码位置

- `src/shared/models.ts`：平台 ID、任务、桌面 API。
- `src/shared/content.ts`：内容类型 `article | moment | video | audio`，以及 `supportedKinds`、`validatePublish`。
- `src/shared/platforms.ts`：平台名称、角标和颜色。每个 `PlatformId` 都要有条目。
- `src/main/platforms/catalog.ts`：登录页和会话判断。每个平台都要有 `sessions` 条目。
- `src/main/platforms/registry.ts`：按平台创建发布器。没有发布流程的平台保持 `LoginAdapter`。
- `src/main/platforms/web/`：文章、动态和音频的浏览器编辑流程。已有视频平台的成功路径留在各自适配器里。
- `src/main/publish/`：发布前校验、复制素材、可配置并行队列。
- `src/main/storage/`：Drizzle schema 与 SQLite。
- `src/main/control/`：Agent 本机控制面（Hono + OpenAPI）。`Eventually` 阶段监听 `127.0.0.1`，写 `~/.mediax/control.json`（或 `MEDIAX_HOME`）；`GET /health` 需 bearer；`GET /doc` 为 OpenAPI。可用 `MEDIAX_CONTROL_DISABLE=1` / `MEDIAX_CONTROL_PORT`。
- `src/renderer/pages/ComposePage.tsx`：文章、动态、视频、音频创作页。

界面用 React、TanStack Router/Query、Tailwind 和 shadcn/Base UI。图标只用 Lucide。视觉规范见 `docs/ui-style.md`。

## 发布约束

发布使用应用内 Electron Chromium，经本机 CDP 由 Playwright 操作。不要另开浏览器，也不要注入到用户日常浏览器。

创作页只有文章、动态、视频、音频。文章要标题和正文，最多一张封面；动态要正文，附件只能是图片；视频和音频可以没有正文，但必须各有一个对应文件。只列出支持当前类型的账号。能力表以 `supportedKinds` 为准。已有的抖音、快手、小红书图文就是动态，不要再写一套。

正文保持纯文本，外加现有 Markdown 导入。不要加富文本编辑器，也不要加定时发布。

`createTask` 要求目标 `identityId` 为数字。站点没有数字 ID 时用 `"1"`，名称仍显示站点上的账号名。

点击发布前调用 `markSubmitted`。控件缺失或未登录时抛 `NeedsUser`，让任务停在待人工处理，不要假装已发布。

## 数据

当前 schema 拒绝高于 5 的 `user_version`。下一张迁移是 `drizzle/0003_*.sql`，并把 `Database` 的版本上限改到 6，同时把“版本过高”测试再加一档。已发布的 SQL 不要改。改表用 `pnpm run db:generate`，并提交 SQL、`drizzle/meta/_journal.json` 和快照。不要对用户库执行 `drizzle-kit push`。

业务库在 `~/Library/Application Support/mediax/mediax.sqlite`。`MEDIAX_USER_DATA` 可改测试目录。开发日志在仓库 `logs/main.log`。日志里不要写正文、Cookie、密码或图片预览。

## 性能优化

对标 [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)、VS Code（code cache / UtilityProcess / 生命周期分阶段）和 Codex Desktop（重活出主进程）。改启动路径或主进程重活时遵守本节，不要为了省事把同步 I/O 或大模块重新塞回冷启动。

### 已落地

| 措施                                                                       | 位置 / 约定                                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ready 前 `Menu.setApplicationMenu(null)`                                   | `src/main/index.ts`                                                                    |
| 单实例冲突用 `app.exit(0)`，不用 `app.quit()`                              | 避免启动期 Chrome_IOThread SIGTRAP                                                     |
| 主窗口 / 账号视图 `spellcheck: false`、`v8CacheOptions: 'bypassHeatCheck'` | `index.ts`、`AccountBrowserManager`                                                    |
| 版本升级清 Chromium code cache                                             | `src/main/desktop/codeCache.ts`                                                        |
| CDP 就绪与窗口 `loadURL`/`loadFile` 并行                                   | `index.ts`                                                                             |
| 生命周期 `Starting → Restored → Eventually`                                | `src/main/desktop/appLifecycle.ts`；账号同步、自动更新只进 Eventually                  |
| 启动埋点 `mediax/will*` / `did*`                                           | `src/main/desktop/perfMarks.ts`；Eventually 打摘要日志                                 |
| 懒加载 `playwright-core`、`electron-updater`                               | `CdpBridge.connect`、`AppUpdater` 首次使用时再 `import`                                |
| 素材 / Markdown 导入进 UtilityProcess                                      | `src/main/content/mediaImportHost.ts` + `workers/mediaImportWorker.ts`；失败回退主进程 |

### Agent 约束

- **主进程**：禁止新增同步 `fs` / `child_process`（`*Sync`）挡在 UI 线程上；长 CPU 或大文件编解码放 UtilityProcess / Worker，或延到 Eventually。
- **启动**：不要在 `markRestored` 之前拉起账号全量同步、更新检查、或其它可延后的网络 / 磁盘扫描。
- **模块**：冷启动路径不要静态 `import` 重依赖（Playwright、updater、大解析库）；需要时再动态加载。
- **窗口**：新 `BrowserWindow` / `WebContentsView` 默认带上 `sandbox`、`contextIsolation`、`spellcheck: false`；打包向 UI 用 `v8CacheOptions: 'bypassHeatCheck'`。账号内嵌页若必须后台保持活跃可关 `backgroundThrottling`，主窗口不要默认关。
- **发布 CDP**：仍须留在主进程（要碰 `webContents`）；不要为了「性能」另开用户浏览器或把 Playwright 塞进渲染进程。
- **验证**：改启动或导入路径后跑 `pnpm run typecheck` 与 `pnpm run test:unit`；关注日志里的 `[perf]` 与 `Startup performance marks`。

参考清单与排期备注见 `docs/TODO.md`。

## TypeScript 类型

目标：改完后尽量不出现 `tsc` 错误；`pnpm run typecheck` 必须通过。不要用大面积 `as any` / `@ts-ignore` 糊弄过去。

### 约定

- 保持 `strict`；新增 API、IPC、共享模型先写清类型（优先改 `src/shared/models.ts` 等共享定义）。
- DOM 集合可迭代：`tsconfig` 已含 `DOM` + `DOM.Iterable`。对 `NodeListOf` / `HTMLCollection` 用 `for...of`、展开或 `Array.from(...)` 均可；不要为绕过类型去关 lib。
- 常见坑示例：
  - `TS2488`：`NodeListOf<Element>` 不可迭代 → 确认 lib 含 `DOM.Iterable`，或写成 `Array.from(document.querySelectorAll(...))`。
  - Playwright `Locator` / `Page` 与 DOM 类型不要混用；`page.evaluate` 回调内只使用可序列化进浏览器的类型。
  - Electron 主进程不要引用仅渲染层存在的 DOM 全局；预加载与沙箱边界上的值用显式类型收窄。
- 联合类型与 `PlatformId` / `ContentKind` 用穷尽检查（`switch` + `never`），避免漏平台。
- 禁止无必要的 `any`；确需放宽时用更窄的断言或类型守卫，并注明原因。

### 验证

涉及类型、共享模型、IPC、平台适配器或 DOM/Playwright 脚本时，提交前跑：

```sh
pnpm run typecheck
```

## 改动习惯

界面改动用 `pnpm run test:ui` 走通受影响的流程。主进程和发布规则用 `pnpm run test:unit`。类型改动再跑 `pnpm run typecheck`。格式用 oxfmt，检查用 oxlint。

除非用户明确要求，不要提交或推送。不要改 git 配置，不要跳过钩子。
