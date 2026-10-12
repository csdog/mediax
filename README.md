# media-post

macOS 本地 Facebook 内容工具。Electron + TypeScript + React + Tailwind CSS + shadcn/ui 官方组件；SQLite（better-sqlite3）保存业务数据。

## 当前状态

已实现独立账号浏览器、账号信息持久化、Markdown 转文本、图片选择与预览、SQLite 草稿保存、三页布局与空发布记录视图。

共用 Electron Chromium 的 CDP 验证已通过开发构建及初版 arm64 未签名打包测试：双会话隔离、重启保持、文件上传、定位与重连。完整界面 arm64 未签名打包回归亦通过，包含 SQLite 原生模块、账号与草稿重启持久化。

**Facebook 实际发布尚尚不可用，按钮禁用。** 尚未取得已登录的真实 Facebook 页面来验证个人身份、Page 权限和永久链接。平台发布适配器尚未实现。串行队列核心已实现并通过暂停恢复、未知结果防重和明确失败重试测试，但未接入真实 Facebook 或 UI 发布入口。不能将界面或模拟测试通过理解为这些功能已经可用。实施计划保留在 `.scratch/to-plan/media-post.md`。

## 开发

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run dev
```

安装后会为 Electron ABI 重建 SQLite 原生模块。测试用 Electron 的 Node 模式运行，避免宿主 Node ABI 不一致。

```sh
mise exec -- pnpm run typecheck
mise exec -- pnpm run test:unit
mise exec -- pnpm run test:ui
mise exec -- pnpm run test:integration
mise exec -- pnpm run package:mac
mise exec -- pnpm run test:packaged
```

应用数据位于 Electron userData；`media-post.sqlite` 保存业务数据，账号会话由 Electron persistent partition 保存。测试使用临时目录，不操作真实 Facebook、不读取日常浏览器 Cookie。

## 下一步真实页面验证

在账号管理添加账号、打开浏览器并手动登录。由用户允许后，只读检查当前个人身份及可管理 Page；不点击发布。若无法可靠识别或 Facebook 拒绝嵌入登录，按计划停止并重新讨论方案。真实发帖验收需要单独明确授权目标和测试内容。

## 本地工具链

`mise.toml` 固定 Node 26.9.0 和 pnpm 12.4.2，package.json 声明 Node >=26.9.0 和带校验值的 pnpm 版本。依赖由 pnpm-lock.yaml 锁定；不再使用 npm 锁文件或 Prettier。

`pnpm run fmt` / `pnpm run fmt:check` 使用 oxfmt；`pnpm run lint` / `pnpm run lint:fix` 使用 oxlint。Husky 的 pre-commit 调用 lint-staged，仅检查及格式化暂存文件，不自动暂存整个项目。使用前确保终端 Node/pnpm 版本与 mise 配置一致。

## UI 组件

所有官方注册表组件已导入 `src/renderer/components/ui`（63 个组件条目，共 64 个源码文件，另含 hooks）。默认采用 shadcn New York / Neutral 主题和语义 CSS 变量；页面优先组合 Sidebar、Card、Input、Textarea、Badge、Avatar、Alert、Empty、Table 等现成组件。

安装工具为官方 shadcn CLI 4.21.4。`--all` 的上游清单包含缺失的 New York v4 条目，已分别从官方 Radix Nova 来源补入 Questionnaire、旧 New York 来源补入 Toast。Questionnaire 的站点内部图标占位符已替换为 Lucide CheckIcon；Combobox 未使用的 children 参数已标记为 `_children`。Toast 为兼容保留，新通知优先使用 Sonner。未引入演示页面或业务 Blocks。

## 桌面布局

主窗口隐藏原生标题栏，保留 macOS 红黄绿控制按钮，顶部提供可拖动区。视觉参考 Codex：窄侧栏、ChatGPT 风格中性灰白背景、紧凑导航与无阴影内容卡片；继续使用 shadcn 组件。侧栏收起后保留展开入口，并为窗口控制按钮预留空间。
