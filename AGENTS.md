# AGENTS.md

## 项目与工作目录

MediaX 是本地多平台发布应用。Git 仓库是 `mediax-desktop/`，外层 `mediax/` 只是容器；开发、测试、打包和 Git 操作都在仓库目录执行。

- 产品显示名用 **MediaX**；协议、包名、数据目录等标识符用小写 `mediax`，见 `src/shared/product.ts`。
- Node 与 pnpm 版本以 `mise.toml` 为准；`electron` 不在 PATH 上，通过 `pnpm run` 或 `pnpm exec` 调用。
- 开发、打包、Dock 名和 `MediaX.app` 重命名步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
- 界面采用 React、TanStack Router/Query、Tailwind 和 shadcn/Base UI；图标只用 Lucide。视觉规范见 [docs/ui-style.md](docs/ui-style.md)。

## 工作原则

- 编写和修改文档时，多项说明必须分点表达，每点说明一件事，避免将多项信息堆成一大段文字。按内容层级选择格式：章节编号用「一、二、三」，有先后顺序的操作步骤用「1、2、3」有序列表，并列说明用无序列表；同一层级保持格式一致，内容简洁清楚。
- **优先复用现有工具和成熟库。** 先查项目已有实现与依赖，再考虑新依赖；轮询、请求状态、缓存、路由、表单、日期、样式合并等不要重复造轮子。只有现有方案确实不能满足业务时，才小范围自行实现。
- 用户提示只显示清楚的原因和处理建议，不展示 IPC 方法名、错误码、代码、文件路径或调用栈；技术详情保留在诊断日志中。
- 日志中不要写正文、Cookie、密码或图片预览。
- 未经用户明确要求，不提交、不推送、不正式发版；不修改 Git 配置，不跳过钩子。

## 命令与验证

在仓库目录通过 `mise exec --` 执行：

```sh
mise exec -- pnpm run dev
mise exec -- pnpm run typecheck
mise exec -- pnpm run test:unit
mise exec -- pnpm run test:ui
mise exec -- pnpm run lint
mise exec -- pnpm run fmt
```

按改动范围验证，避免重复检查：

- 界面与交互：`test:ui`，走通受影响的流程。
- 主进程、发布规则、启动或导入路径：`test:unit`；启动改动还要关注日志中的 `[perf]` 与 `Startup performance marks`。
- 类型、共享模型、IPC、平台适配器、DOM / Playwright 脚本或启动 / 导入路径：`typecheck` 必须通过。
- 格式使用 oxfmt，静态检查使用 oxlint。
- **集成与打包测试仅在用户明确要求时执行。** 不要为了验证向真实账号发布内容。

### 测试目录组织

- `tests/` 第一层按测试类型保留 `unit/`、`ui/`、`integration/`；**各类型目录内必须再按业务或模块分子目录，新增测试不得直接平铺在 `tests/` 或类型目录根部。** 例如 `tests/unit/accounts/account-name.test.ts`、`tests/unit/desktop/toast-overlay.test.ts`、`tests/ui/demos/toast-demo.test.tsx`、`tests/integration/accounts/account-avatar.test.mjs`。
- 模块划分尽量对应 `src/`，同一模块在不同测试类型下使用一致的目录名；平台专属用例放到 `platforms/<平台>/`。模块内文件较多时继续按功能细分，不设用于兜底堆文件的 `misc/`、`other/` 目录，也不预建空目录。
- 专属 fixture、mock、helper 与所属模块放在一起；确有跨模块复用时再放到 `tests/fixtures/<模块>/` 或 `tests/helpers/<模块>/`。类型级公共 setup 可保留在对应类型目录根部，测试产生的临时文件使用临时目录并清理。
- 新增测试文件使用 kebab-case，沿用 `.test.ts`、`.test.tsx`、`.test.mjs` 后缀；按被测模块命名，避免把不同模块的用例合并成不断膨胀的大文件。
- 修改已有平铺测试时，随当前改动将相关用例归入对应模块，并同步修正导入、mock 路径与快照位置；不为了补充约定而全量搬迁无关测试。
- 新增或移动测试后必须确认测试仍会被发现。Vitest 已使用递归匹配；**集成与打包测试命令目前只匹配 `tests/integration/*.test.mjs`，首次引入子目录时须同步调整这两个命令的匹配范围**，避免文件移动后静默漏跑。

## 代码导航

- `src/shared/models.ts`：平台 ID、任务模型、桌面 API。
- `src/shared/content.ts`：内容类型、`supportedKinds` 和 `validatePublish`；平台发布能力以这里为准。
- `src/shared/platforms.ts`：平台名称、角标和颜色；每个 `PlatformId` 都必须有条目。
- `src/main/platforms/catalog.ts`：平台入口和会话判断；每个平台都必须有 `sessions` 条目。
- `src/main/platforms/registry.ts`：发布器注册；未实现发布流程的平台保持 `LoginAdapter`。
- `src/main/platforms/web/`：文章、动态、音频的浏览器编辑流程；已有视频平台的成功路径留在各自适配器中。
- `src/main/publish/`：发布前校验、素材复制、可配置并行队列。
- `src/main/storage/`：Drizzle schema 与 SQLite。
- `src/renderer/pages/ComposePage.tsx`：文章、动态、视频、音频创作页。
- `src/main/control/`：Agent 本机控制面，使用 Hono + OpenAPI；在 `Eventually` 阶段监听 `127.0.0.1`。连接信息写入 `~/.mediax/agent/control.json`，根目录可通过 `MEDIAX_HOME` 覆盖；`GET /health` 需 bearer，`GET /doc` 提供 OpenAPI。配置项为 `MEDIAX_CONTROL_DISABLE=1` 和 `MEDIAX_CONTROL_PORT`。

## 内容与发布

- 发布使用应用内 Electron Chromium，由 Playwright 经本机 CDP 操作；不要另开浏览器或注入用户的日常浏览器。发布 CDP 留在主进程，不移入渲染进程或 Worker。
- 创作页只有 `article | moment | video | audio`：文章需要标题和正文，最多一张封面；动态需要正文，附件只能是图片；视频和音频可以没有正文，但必须各有一个对应文件。
- 账号列表只显示支持当前内容类型的账号。已有的抖音、快手、小红书图文属于动态，不另建内容类型。
- 正文保持纯文本，复用现有 Markdown 导入，不增加富文本编辑器。
- `createTask` 的目标 `identityId` 必须为数字字符串；站点没有数字 ID 时用 `"1"`，名称仍显示站点账号名。
- 点击发布前调用 `markSubmitted`。控件缺失或未登录时抛 `NeedsUser`，让任务停在待人工处理，不假装发布成功。
- 定时任务带 `scheduledAt`，目标状态为 `scheduled`；仅在 MediaX 运行时，由 `ScheduleService` 到点改为 `pending` 并入队。关机不保证发布，可配合「发布/排期时保持唤醒」设置阻止空闲睡眠；屏幕仍可熄灭。

## 界面与类型

### Tailwind 优先

- 一次性样式直接写在组件 `className` 中，例如 `inline-flex items-center justify-center gap-1`。
- 复用样式优先抽小组件；确需保留 class 钩子时，使用 CSS `@apply` 组合 utility。
- 裸 CSS 仅用于现有 token、窗口外壳，或 utility 无法表达的选择器和动画，例如 `workspace.css`、`tokens.css`。
- 历史页面、表单和列表操作默认用 Tailwind；同一块布局不在 Tailwind 与自定义 CSS 中重复定义。

### TypeScript 边界

- 保持 `strict`；新增 API、IPC 和共享模型先明确类型。禁止大面积 `as any` / `@ts-ignore`；确需断言时使用更窄的类型或类型守卫，并说明原因。
- `PlatformId`、`ContentKind` 等联合类型使用穷尽检查，避免漏平台或内容类型。
- `tsconfig` 已包含 `DOM` 和 `DOM.Iterable`；DOM 集合可使用 `for...of`、展开或 `Array.from`，不要为绕过报错关闭类型库。
- Playwright `Locator` / `Page` 与 DOM 类型不混用；`page.evaluate` 回调只使用可序列化传入的值和页面内可访问的变量。
- Electron 主进程不引用仅渲染层存在的 DOM 全局；预加载与沙箱边界的值显式收窄类型。

## 数据与迁移

- 业务库位于 `~/Library/Application Support/mediax/mediax.sqlite`；测试可通过 `MEDIAX_USER_DATA` 指定目录。开发日志位于仓库 `logs/main.log`。
- 当前数据库拒绝高于 6 的 `user_version`。下一张迁移为 `drizzle/0004_*.sql`，届时将 `Database` 上限改为 7，并同步提高“版本过高”测试档位。
- 已发布的迁移 SQL 不修改。改表使用 `pnpm run db:generate`，同时提交 SQL、`drizzle/meta/_journal.json` 和快照。
- 不对用户数据库执行 `drizzle-kit push`。

## 性能与窗口生命周期

参考 [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)，沿用 VS Code 的 code cache / UtilityProcess / 分阶段生命周期，以及将重活移出主进程的原则。排期见 [docs/TODO.md](docs/TODO.md)。

- 主进程禁止新增同步 `fs` / `child_process`（`*Sync`）阻塞 UI；长 CPU 任务和大文件编解码放 UtilityProcess / Worker，或延到 `Eventually`。
- 在 `markRestored` 前不启动账号全量同步、更新检查或其他可延后的网络 / 磁盘扫描。生命周期顺序保持 `Starting → Restored → Eventually`。
- 冷启动不静态导入 Playwright、updater 或大解析库等重依赖，需要时再动态加载。
- 新窗口与账号视图保持 `sandbox`、`contextIsolation`，默认关闭拼写检查；账号页为原生拼写菜单显式启用。主窗口保持 `spellcheck: false`，打包界面使用 `v8CacheOptions: 'bypassHeatCheck'`。
- 账号内嵌页确需后台活跃时可关闭 `backgroundThrottling`；主窗口不默认关闭。显式管理视图及其 `webContents` 的关闭与销毁。
- 保留已落地的启动优化：ready 前清默认菜单、单实例冲突用 `app.exit(0)`、版本升级清 Chromium code cache、CDP 就绪与窗口加载并行、启动性能埋点、Markdown / 素材导入进 UtilityProcess 并保留失败回退。
- 相关实现位于 `src/main/index.ts`、`browser/CdpBridge.ts`、`browser/AccountBrowserManager.ts`、`desktop/codeCache.ts`、`desktop/appLifecycle.ts`、`desktop/perfMarks.ts`、`desktop/AppUpdater.ts`、`content/mediaImportHost.ts` 和 `workers/mediaImportWorker.ts`；以上未带前缀的路径均相对 `src/main/`。

## Git、版本与正式发版

### 日常开发

- 在功能分支上开发和提交；普通提交、推送、PR 合并以及开发 / 测试打包都不视为正式发版。
- **开发期间保留当前版本号，不为每项功能或修复升版本号。** 用户只要求「提交」「推送」「提交并推送」或「合并 PR」时，不自行升版本号、打 tag 或发布 Release。

### 正式发版

只有用户明确要求正式发版时才执行以下流程：

1. 汇总自上一正式版本以来的全部改动，按 semver 选择下一版本：破坏性变更 → major；新增功能 → minor；兼容性修复 → patch。一次发版只提升一次 `package.json` 的 `version`。
2. 将版本变更纳入发版 PR，审查后合并进 `main`。GitHub 自动生成的 What's Changed 汇总已合并 PR，因此默认通过 PR 发版。
3. 在同一轮发版操作内，为对应的已合并提交打并推送同号标签：版本 `X.Y.Z` → tag `vX.Y.Z`，触发 GitHub Actions 构建安装包并发布同标签 Release。
4. 确认构建成功、Release 已发布、安装包上传完整且版本一致后，才报告发版完成。失败时处理同一次发版，不为重试反复升版本号。

仅推送 `main` 不会发版；只改版本号、只打标签或只建 Release 都不算完成发版。用户明确要求「直推 / 不要 PR」时才直推，并自行写清 Release 正文；无论哪种流程，正式发版都要完成版本号、tag、Release 和安装包验证。

### 标签（tag）

- 本仓库 GitHub 为 **`csdog/mediax`**；本地目录名 `mediax-desktop` 与远程仓名无关。外层 `mediax/` 若并列 `mediax-agent/`，打 tag 或 `git push` 前必须 **`git -C <本仓绝对路径>`** 并核对 **`git remote get-url --push origin`**，避免误推到 sibling 仓。
- 在 **`main` 上、且 `package.json` 的 `version` 已是发布号** 的提交打 tag（常见为发版 PR 合并后的 `chore(release): bump …`）；版本 `X.Y.Z` → 标签 **`vX.Y.Z`**，与 `package.json` 一致。
- 推送 `v*` 触发 `.github/workflows/build.yml` 与 GitHub Release；**推送 tag 不等于发版完成**，须等 Actions 成功且安装包上传完整后再向用户报告。
- 标签打在错误提交或推错远程：仅在用户确认后删除该次 **GitHub Release** 与 **远程 tag**，再在正确提交上重打**同号** tag；不为重试 CI 反复升版本号。

### 分支清理

- **`feat/*`、`fix/*` 等在 PR 合并进 `main` 后通常不必保留**；历史在 merge commit、PR 页面与 tag 上，不依赖长期留着分支名。
- 合并 PR 时优先勾选 **Delete branch**；若远程仍在，本地 `git fetch -p origin` 后：`git branch -d <branch>`，必要时 `git push origin --delete <branch>`。
- 用户说「清理分支」，或在 **PR 合并 / 正式发版收尾** 时，可对**已合并**分支做上述清理；勿删未合并分支，勿动 `main` 及团队约定的长期 release 线（若有）。
