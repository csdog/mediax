# 开发与打包

给人 / Agent 改本仓代码时用。产品说明见 [README.md](../README.md)；写代码约定见 [AGENTS.md](../AGENTS.md)。

Git 与工具配置在本目录（GitHub 仓库根）。若本地还有外层 `mediax/` 容器，请进入本目录再执行命令。

## 本地开发

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run dev
```

开发界面默认 `http://127.0.0.1:5186`，可用 `.env.local` 的 `MAIN_VITE_DEV_SERVER_PORT` 修改。

```sh
mise exec -- pnpm run typecheck
mise exec -- pnpm run test:unit
mise exec -- pnpm run test:ui
mise exec -- pnpm run test:integration
mise exec -- pnpm run package:mac
mise exec -- pnpm run test:packaged
```

`electron` 不在 PATH 上，用 `pnpm run` / `pnpm exec`。`pnpm run fmt` / `lint` 使用 oxfmt / oxlint；Husky pre-commit 只检查暂存文件。

`pnpm dev --watch` 在保存主进程文件时会重建，并可能断开正在使用的 CDP。集成 / 打包测试会启真实 Electron（含 Facebook 夹具）；只有明确需要时再跑。不要为了验证向真实账号再发一条帖。

macOS 开发态 Dock / ⌘-Tab 名称优先看 `.app` **文件夹名**。`pnpm dev` 前与 `postinstall` 会把 `Electron.app` 重命名为 `MediaX.app`；改完后需完全退出旧进程再开。

同一补丁会生成 `MediaX.icns` 并更新应用包及 Helper 的 `CFBundleIconFile`，用于活动监视器等系统界面；`app.dock.setIcon()` 只负责运行时 Dock 图标。活动监视器可能保留已加载的旧图标，替换图标后应通过其菜单「退出活动监视器」完整退出再重新打开，不能只关闭窗口。验证时同时核对 MediaX 的 PID，确认查看的是本次开发进程。

## 打包

| 命令                        | 产物                               |
| --------------------------- | ---------------------------------- |
| `pnpm run package:mac`      | macOS 未打包目录（本地测试）       |
| `pnpm run package:mac:dist` | macOS `dmg` / `zip`（arm64 + x64） |
| `pnpm run package:win`      | Windows `nsis` / `portable`（x64） |
| `pnpm run package:linux`    | Linux `AppImage` / `deb`（x64）    |
| `pnpm run package`          | 当前机器尽量打出三端               |

跨平台产物优先用 GitHub Actions（`.github/workflows/build.yml`）：打 `v*` 标签或手动触发。本机交叉打包可能受签名工具与原生模块限制。

打包版通过 `electron-updater` 从 GitHub Releases（`csdog/mediax`）检查更新：启动约 15 秒后后台检查，设置 → 常规 → 更新可手动检查；下载完成后可「重启安装」。开发模式不检查。正式签名与公证仍待补齐。

发版流程（PR → merge → `v*` tag）见 [AGENTS.md](../AGENTS.md)。

## 技术栈

| 层     | 选型                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 桌面   | Electron 44 · electron-vite · electron-builder                           |
| 界面   | React 19 · TanStack Router / Query · Tailwind CSS · shadcn/ui（Base UI） |
| 数据   | Drizzle ORM · better-sqlite3 · WAL                                       |
| 自动化 | Playwright（操作各平台网页编辑器）                                       |
| 工具链 | mise（Node 26.9 · pnpm 12.4）· TypeScript 7 · oxlint · oxfmt · Vitest    |

UI 与窗口说明：[ui-style.md](ui-style.md)、[window-chrome.md](window-chrome.md)。

## UI

shadcn 使用官方 `base-nova`（Base UI），配置在 `components.json`。组件组合用 Base UI `render` API；Toast 优先 Sonner。

## 渲染结构

```text
src/renderer/
  src.tsx                 # 入口
  app/                    # Router、Query、工作区 Context
  pages/                  # 账号、发布、记录、设置、浏览器
  components/workspace/   # 工具栏、导航、页面容器
  components/dialogs/     # 公共弹窗
  components/ui/          # shadcn / Base UI
  hooks/                  # 桌面协调、布局、快捷键
```

## SQLite 迁移

```sh
mise exec -- pnpm run db:generate --name=describe_change
mise exec -- pnpm run db:check
```

表定义在 `src/main/storage/schema.ts`；迁移输出在 `drizzle/`。不要对真实用户库执行 `drizzle-kit push`。

## 环境与日志

| 文件                                   | 作用                     |
| -------------------------------------- | ------------------------ |
| `.env`                                 | 共用非敏感默认值         |
| `.env.development` / `.env.production` | 开发 / 生产日志等级      |
| `.env.local` / `.env.*.local`          | 本机覆盖（已 gitignore） |

| 变量                        | 用途                        |
| --------------------------- | --------------------------- |
| `MAIN_VITE_DEV_SERVER_PORT` | 开发服务器端口，默认 `5186` |
| `VITE_LOG_CONSOLE_LEVEL`    | console 等级                |
| `MAIN_VITE_LOG_FILE_LEVEL`  | 文件日志等级                |
| `MAIN_VITE_LOG_MAX_SIZE`    | 单文件轮转字节，默认 5 MiB  |

开发日志：`logs/main.log`。安装包日志：`<userData>/logs/main.log`（macOS 一般为 `~/Library/Application Support/mediax/logs/main.log`）。超过大小限制后滚动为 `main.YYYY-MM-DD.log`。不记录正文、Cookie、密码。

## 桌面行为（macOS 等）

关闭主窗口默认隐藏到托盘；菜单栏 / Dock 可恢复。窗口几何、标签与草稿保存在 SQLite。单实例运行。全局呼出快捷键默认 `⌘M`，可在设置中修改。
