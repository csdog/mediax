# AGENTS.md

macOS 本地多平台发布应用。Git 仓库是 `media-post-desktop/`；外层 `media-post/` 只是容器。开发、测试和打包都在本目录执行。

## 命令

Node 与 pnpm 以 `mise.toml` 为准。`electron` 不在 PATH 上，用 `pnpm run` 或 `pnpm exec`。

```sh
pnpm run dev
pnpm run typecheck
pnpm run test:unit
pnpm run test:ui
pnpm run lint
pnpm run fmt
```

`pnpm dev --watch` 在保存主进程文件时会重建，并可能断开正在使用的 CDP。集成测试会启动真实 Electron，且包含 Facebook 发布夹具；只有用户明确要求时才运行 `test:integration` 或 `test:packaged`。不要为了验证而向真实账号再发一条帖。

## 代码位置

- `src/shared/models.ts`：平台 ID、任务、桌面 API。
- `src/shared/content.ts`：内容类型 `article | moment | video | audio`，以及 `supportedKinds`、`validatePublish`。
- `src/shared/platforms.ts`：平台名称、角标和颜色。每个 `PlatformId` 都要有条目。
- `src/main/platforms/catalog.ts`：登录页和会话判断。每个平台都要有 `sessions` 条目。
- `src/main/platforms/registry.ts`：按平台创建发布器。没有发布流程的平台保持 `LoginAdapter`。
- `src/main/platforms/web/`：文章、动态和音频的浏览器编辑流程。已有视频平台的成功路径留在各自适配器里。
- `src/main/publish/`：发布前校验、复制素材、串行队列。
- `src/main/storage/`：Drizzle schema 与 SQLite。
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

业务库在 `~/Library/Application Support/media-post/media-post.sqlite`。`MEDIA_POST_USER_DATA` 可改测试目录。开发日志在仓库 `logs/main.log`。日志里不要写正文、Cookie、密码或图片预览。

## 改动习惯

界面改动用 `pnpm run test:ui` 走通受影响的流程。主进程和发布规则用 `pnpm run test:unit`。类型改动再跑 `pnpm run typecheck`。格式用 oxfmt，检查用 oxlint。

除非用户明确要求，不要提交或推送。不要改 git 配置，不要跳过钩子。
