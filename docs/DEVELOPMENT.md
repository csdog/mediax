# 开发与打包

- **文档用途**：给人 / Agent 改本仓代码时用。产品说明见 [README.md](../README.md)；写代码约定见 [AGENTS.md](../AGENTS.md)。
- **工作目录**：Git 与工具配置在本目录（GitHub 仓库根）。若本地还有外层 `mediax/` 容器，请进入本目录再执行命令。

## 一、本地开发

### 启动步骤

1. **初始化工具链**：

   ```sh
   mise trust
   mise install
   ```

2. **安装依赖**：

   ```sh
   mise exec -- pnpm install --frozen-lockfile
   ```

3. **启动应用**：

   ```sh
   mise exec -- pnpm run dev
   ```

### 开发说明

- **开发地址**：默认 `http://127.0.0.1:5186`，可用 `.env.local` 的 `MAIN_VITE_DEV_SERVER_PORT` 修改。
- **启动 Demo 导航**：先退出其他 MediaX 实例，再运行：

  ```sh
  mise exec -- pnpm run dev:demo
  ```

- **导航内容**：`demos/index.html` 集中列出所有本地演示，当前包括原生 Toast 通知。
- **演示目录**：所有演示放在 `src/renderer/demos/`，每个演示使用独立子目录与 HTML 入口，在 `catalog.ts` 中登记导航信息。
- **构建检查**：Demo 目录不在生产构建入口中；`pnpm run build` 会检查产物，发现 Demo 目录、页面或引用即失败。
- **安装包**：GitHub 打包沿用同一构建命令，因此安装包不包含 Demo。
- **验证命令**：

  ```sh
  mise exec -- pnpm run typecheck
  mise exec -- pnpm run test:unit
  mise exec -- pnpm run test:ui
  mise exec -- pnpm run test:integration
  mise exec -- pnpm run package:mac
  mise exec -- pnpm run test:packaged
  ```

- **工具调用**：`electron` 不在 PATH 上，用 `pnpm run` / `pnpm exec`。`pnpm run fmt` / `lint` 使用 oxfmt / oxlint；Husky pre-commit 只检查暂存文件。
- **热重建**：`pnpm dev --watch` 在保存主进程文件时会重建，并可能断开正在使用的 CDP。
- **真实 Electron 测试**：集成 / 打包测试会启动真实 Electron（含 Facebook 夹具），只有明确需要时再跑。不要为了验证向真实账号再发一条帖。
- **Dock 与 ⌘-Tab 名称**：macOS 开发态优先看 `.app` **文件夹名**。`pnpm dev` 前与 `postinstall` 会把 `Electron.app` 重命名为 `MediaX.app`；改完后需完全退出旧进程再开。
- **应用图标**：同一补丁会生成 `MediaX.icns` 并更新应用包及 Helper 的 `CFBundleIconFile`，用于活动监视器等系统界面；`app.dock.setIcon()` 只负责运行时 Dock 图标。
- **活动监视器验证**：活动监视器可能保留已加载的旧图标。替换图标后，应通过其菜单「退出活动监视器」完整退出再重新打开，不能只关闭窗口；同时核对 MediaX 的 PID，确认查看的是本次开发进程。

## 二、打包

- **macOS 本地测试目录**：`pnpm run package:mac`。
- **macOS 安装包**：`pnpm run package:mac:dist`，产出 `dmg` / `zip`（arm64 + x64）。
- **Windows 安装包**：`pnpm run package:win`，产出 `nsis` / `portable`（x64）。
- **Linux 安装包**：`pnpm run package:linux`，产出 `AppImage` / `deb`（x64）。
- **三端打包**：`pnpm run package`，在当前机器尽量打出三端产物。
- **跨平台构建**：优先使用 GitHub Actions（`.github/workflows/build.yml`），通过 `v*` 标签或手动触发。本机交叉打包可能受签名工具与原生模块限制。
- **自动更新**：打包版通过 `electron-updater` 从 GitHub Releases（`csdog/mediax`）检查更新。启动约 15 秒后后台检查，也可在「设置 → 常规 → 更新」手动检查；下载完成后可「重启安装」。开发模式不检查。
- **签名与公证**：正式签名与公证仍待补齐。
- **正式发版**：PR → merge → `v*` tag 的流程见 [AGENTS.md](../AGENTS.md)。

## 三、技术栈

- **桌面**：Electron 44、electron-vite、electron-builder。
- **界面**：React 19、TanStack Router / Query、Tailwind CSS、shadcn/ui（Base UI）。
- **数据**：Drizzle ORM、better-sqlite3、WAL。
- **自动化**：Playwright，用于操作各平台网页编辑器。
- **工具链**：mise（Node 26.9、pnpm 12.4）、TypeScript 7、oxlint、oxfmt、Vitest。
- **UI 与窗口说明**：[ui-style.md](ui-style.md)、[window-chrome.md](window-chrome.md)。

## 四、UI

- **组件风格**：shadcn 使用官方 `base-nova`（Base UI），配置在 `components.json`。
- **组件组合**：使用 Base UI `render` API。
- **Toast**：优先 Sonner。

## 五、渲染结构

- **入口**：`src/renderer/src.tsx`。
- **应用层**：`src/renderer/app/`，包含 Router、Query、工作区 Context。
- **页面**：`src/renderer/pages/`，包含账号、发布、记录、设置与浏览器页面。
- **工作区组件**：`src/renderer/components/workspace/`，包含工具栏、导航与页面容器。
- **公共弹窗**：`src/renderer/components/dialogs/`。
- **基础组件**：`src/renderer/components/ui/`，使用 shadcn / Base UI。
- **Hooks**：`src/renderer/hooks/`，负责桌面协调、布局与快捷键。

## 六、SQLite 迁移

1. **生成迁移**：

   ```sh
   mise exec -- pnpm run db:generate --name=describe_change
   ```

2. **检查迁移**：

   ```sh
   mise exec -- pnpm run db:check
   ```

### 迁移说明

- **表定义**：位于 `src/main/storage/schema.ts`。
- **迁移输出**：位于 `drizzle/`。
- **真实用户库**：不要执行 `drizzle-kit push`。

## 七、环境与日志

### 配置文件

- **`.env`**：共用的非敏感默认值。
- **`.env.development` / `.env.production`**：开发 / 生产日志等级。
- **`.env.local` / `.env.*.local`**：本机覆盖配置，已被 gitignore 忽略。

### 环境变量

- **`MAIN_VITE_DEV_SERVER_PORT`**：开发服务器端口，默认 `5186`。
- **`VITE_LOG_CONSOLE_LEVEL`**：console 日志等级。
- **`MAIN_VITE_LOG_FILE_LEVEL`**：文件日志等级。
- **`MAIN_VITE_LOG_MAX_SIZE`**：单文件轮转字节数，默认 5 MiB。

### 日志文件

- **开发日志**：`logs/main.log`。
- **安装包日志**：`<userData>/logs/main.log`；macOS 一般为 `~/Library/Application Support/mediax/logs/main.log`。
- **日志轮转**：超过大小限制后，滚动为 `main.YYYY-MM-DD.log`。
- **日志内容**：不记录正文、Cookie、密码。

## 八、桌面行为（macOS 等）

- **关闭窗口**：默认隐藏到托盘，可通过菜单栏 / Dock 恢复。
- **状态保存**：窗口几何、标签与草稿保存在 SQLite。
- **实例限制**：单实例运行。
- **全局呼出**：快捷键默认 `⌘M`，可在设置中修改。
