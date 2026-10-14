![MediaX](build/icon.png)

# MediaX

**本地多平台内容发布桌面端**  
一次创作，分发到国内外主流媒体平台  
账号会话隔离 · 本机并行发布 · 不经过第三方云端

![release](https://img.shields.io/github/v/release/csdog/mediax?style=flat-square&label=release)![build](https://img.shields.io/github/actions/workflow/status/csdog/mediax/build.yml?style=flat-square&label=build)![desktop platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-111827?style=flat-square)![publish platforms](https://img.shields.io/badge/publish-32%20platforms-2563eb?style=flat-square)![login platforms](https://img.shields.io/badge/login-56%20platforms-0f766e?style=flat-square)![Electron](https://img.shields.io/badge/Electron-44-47848f?style=flat-square&logo=electron&logoColor=white)![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?style=flat-square&logo=typescript&logoColor=white)![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)

[支持的平台](#支持的平台) · [特性](#特性) · [主要功能](#主要功能) · [快速开始](#快速开始) · [打包](#打包) · [开发](#开发) · [Agent 面](#agent-面) · TODO · [贡献约定](AGENTS.md)

---

## 为什么用 MediaX

多数分发工具把账号和正文交给云端；MediaX 把浏览器会话、草稿和任务都留在本机。

- **一次创作，多端发布** — 文章 / 动态 / 视频 / 音频，按平台能力自动筛选可发账号
- **会话隔离** — 每个账号独立 Electron 分区，登录态互不串扰
- **人工可介入** — 登录、验证码或页面改版时暂停，处理完继续，失败可重试
- **跨桌面系统** — 支持 macOS、Windows、Linux 安装包

## 特性

|                 |                                                             |
| --------------- | ----------------------------------------------------------- |
| ✍️ **四种体裁** | 文章、动态（图文）、视频、音频；正文可导入 Markdown         |
| 🔐 **本机登录** | 应用内浏览器登录各平台，Cookie 保存在本地 partition         |
| 🧵 **并行队列** | 可配置并行数与网速限制，素材快照到任务目录，单文件上限 20MB |
| 🔔 **状态通知** | 成功 / 失败 / 等待处理 / 待核验；点击跳转发布记录           |
| 🗂️ **工作区**   | 账号管理、内容发布、发布记录、设置；标签页与草稿可恢复      |
| 🧪 **可测**     | 单元、UI、集成与打包后的 Electron 端到端测试                |

## 支持的平台

### 桌面系统

| 系统        | 架构        | 产物                       |
| ----------- | ----------- | -------------------------- |
| **macOS**   | arm64 · x64 | `dmg` / `zip`              |
| **Windows** | x64         | `nsis` 安装包 · `portable` |
| **Linux**   | x64         | `AppImage` · `deb`         |

从 [Releases](https://github.com/csdog/mediax/releases) 下载，或打 `v*` 标签触发 GitHub Actions 构建。

### 内容平台

授权网格共 **56** 个平台；其中 **32** 个已接入发布流程，其余可登录、发布适配后续补齐。

#### 已支持发布

|                                                                                            | 平台            | 文章 | 动态 | 视频 |
| ------------------------------------------------------------------------------------------ | --------------- | ---- | ---- | ---- |
| <img src="src/renderer/assets/platforms/toutiao.png" width="20" height="20" alt="">        | 头条号          | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/zhihu.png" width="20" height="20" alt="">          | 知乎            | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/douyin.png" width="20" height="20" alt="">         | 抖音            | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/xiaohongshu.png" width="20" height="20" alt="">    | 小红书          | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/weibo.png" width="20" height="20" alt="">          | 微博            | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/baijiahao.png" width="20" height="20" alt="">      | 百家号          | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/facebook.png" width="20" height="20" alt="">       | Facebook        | ✅   | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/wechat.png" width="20" height="20" alt="">         | 微信公众号      | ✅   | ✅   |      |
| <img src="src/renderer/assets/platforms/douban.png" width="20" height="20" alt="">         | 豆瓣            | ✅   | ✅   |      |
| <img src="src/renderer/assets/platforms/zsxq.png" width="20" height="20" alt="">           | 知识星球        | ✅   | ✅   |      |
| <img src="src/renderer/assets/platforms/bilibili.png" width="20" height="20" alt="">       | 哔哩哔哩        | ✅   |      | ✅   |
| <img src="src/renderer/assets/platforms/qq.png" width="20" height="20" alt="">             | 企鹅号          | ✅   |      | ✅   |
| <img src="src/renderer/assets/platforms/jianshu.png" width="20" height="20" alt="">        | 简书            | ✅   |      |      |
| <img src="src/renderer/assets/platforms/reddit.png" width="20" height="20" alt="">         | Reddit          | ✅   |      |      |
| <img src="src/renderer/assets/platforms/kuaishou.png" width="20" height="20" alt="">       | 快手            |      | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/channels.png" width="20" height="20" alt="">       | 视频号          |      | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/instagram.png" width="20" height="20" alt="">      | Instagram       |      | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/twitter.png" width="20" height="20" alt="">        | X               |      | ✅   | ✅   |
| <img src="src/renderer/assets/platforms/threads.png" width="20" height="20" alt="">        | Threads         |      | ✅   |      |
| <img src="src/renderer/assets/platforms/pinterest.png" width="20" height="20" alt="">      | Pinterest       |      | ✅   |      |
| <img src="src/renderer/assets/platforms/linkedin.png" width="20" height="20" alt="">       | LinkedIn        |      | ✅   |      |
| <img src="src/renderer/assets/platforms/googlebusiness.png" width="20" height="20" alt=""> | Google Business |      | ✅   |      |
| <img src="src/renderer/assets/platforms/youtube.png" width="20" height="20" alt="">        | YouTube         |      |      | ✅   |
| <img src="src/renderer/assets/platforms/tiktok.png" width="20" height="20" alt="">         | TikTok          |      |      | ✅   |
| <img src="src/renderer/assets/platforms/hupu.png" width="20" height="20" alt="">           | 虎扑            |      |      | ✅   |
| <img src="src/renderer/assets/platforms/alipay.png" width="20" height="20" alt="">         | 支付宝生活号    |      |      | ✅   |

音频（仅音频）：

|                                                                                        | 平台       |
| -------------------------------------------------------------------------------------- | ---------- |
| <img src="src/renderer/assets/platforms/ximalaya.png" width="20" height="20" alt="">   | 喜马拉雅   |
| <img src="src/renderer/assets/platforms/xiaoyuzhou.png" width="20" height="20" alt=""> | 小宇宙     |
| <img src="src/renderer/assets/platforms/music163.png" width="20" height="20" alt="">   | 网易云音乐 |
| <img src="src/renderer/assets/platforms/qqmusic.png" width="20" height="20" alt="">    | QQ音乐     |
| <img src="src/renderer/assets/platforms/qingting.png" width="20" height="20" alt="">   | 蜻蜓FM     |
| <img src="src/renderer/assets/platforms/lizhi.png" width="20" height="20" alt="">      | 荔枝FM     |

#### 可登录（发布适配中）

搜狐号、一点号、大鱼号、网易号、爱奇艺、腾讯微视、搜狐视频、皮皮虾、腾讯视频、多多视频、美拍、AcFun、快传号、雪球号、蜂网、得物、京东、CSDN、车家号、小红书商家号、易车号、懂车号、淘宝光合、小红书私信版 等。

完整能力表见 `src/shared/content.ts`，平台元数据见 `src/shared/platforms.ts`。

## 快速开始

### 下载使用

1. 打开 [Releases](https://github.com/csdog/mediax/releases)
2. 按系统下载安装包并打开
3. 在「账号管理」登录平台 → 「内容发布」创作 → 「发布记录」跟进状态

### 本地开发

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

## 使用流程

1. **授权账号** — 账号管理点选平台，在独立浏览器标签页登录并检查状态
2. **选择体裁** — 文章需标题与正文；动态仅图片；视频 / 音频各一个主文件
3. **勾选目标** — 右侧只显示支持当前体裁的账号
4. **确认发布** — 本机按设置并行执行；遇验证或控件缺失会暂停该账号，其他账号可继续
5. **查看记录** — 成功、失败、排队、重试与打开结果页都在发布记录里

定时发布不在当前范围内。关闭账号标签页后，任务会重开同一账号会话。

## 技术栈

| 层     | 选型                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 桌面   | Electron 44 · electron-vite · electron-builder                           |
| 界面   | React 19 · TanStack Router / Query · Tailwind CSS · shadcn/ui（Base UI） |
| 数据   | Drizzle ORM · better-sqlite3 · WAL                                       |
| 自动化 | Playwright（操作各平台网页编辑器）                                       |
| 工具链 | mise（Node 26.9 · pnpm 12.4）· TypeScript 7 · oxlint · oxfmt · Vitest    |

给代理的工作约定见 [AGENTS.md](AGENTS.md)。UI 与窗口说明见 [docs/ui-style.md](docs/ui-style.md)、[docs/window-chrome.md](docs/window-chrome.md)。

## 开发说明

### 仓库位置

Git 与工具配置在本目录（GitHub 仓库根）。若本地还有外层 `mediax/` 容器目录，请进入本目录执行开发与打包命令。

### 工具链

`mise.toml` 固定 Node / pnpm；`pnpm run fmt` / `lint` 使用 oxfmt / oxlint。Husky pre-commit 仅检查暂存文件。

### UI

shadcn 使用官方 `base-nova`（Base UI），配置在 `components.json`。组件组合用 Base UI `render` API；Toast 优先 Sonner。

### 渲染结构

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

### SQLite 迁移

```sh
mise exec -- pnpm run db:generate --name=describe_change
mise exec -- pnpm run db:check
```

表定义在 `src/main/storage/schema.ts`；迁移输出在 `drizzle/`。不要对真实用户库执行 `drizzle-kit push`。

### 环境与日志

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
| `MAIN_VITE_LOG_MAX_SIZE`    | 单文件轮转阈值，默认 5 MiB  |

开发日志：`logs/main.log`。安装包日志：`<userData>/logs/main.log`（macOS 一般为 `~/Library/Application Support/mediax/logs/main.log`）。超过大小限制后滚动为 `main.YYYY-MM-DD.log`（同日多次滚动为 `main.YYYY-MM-DD.1.log`…）。不记录正文、Cookie、密码。

### 桌面行为（macOS 等）

关闭主窗口默认隐藏到托盘；菜单栏 / Dock 可恢复。窗口几何、标签与草稿保存在 SQLite。单实例运行。全局呼出快捷键默认 `⌘M`，可在设置中修改。

## 主要功能

| 功能               | 说明                                                   | 状态 |
| ------------------ | ------------------------------------------------------ | ---- |
| 多账号会话         | 每账号独立 Electron 分区，登录态互不串扰               | ✅   |
| 体裁筛选           | 文章 / 动态 / 视频 / 音频，按平台能力筛选可发账号      | ✅   |
| 本机发布队列       | 确认后并行发布，可配并行数与网速限制                   | ✅   |
| 草稿与工作区       | SQLite 草稿、标签页与窗口几何可恢复                    | ✅   |
| 暂停 / 重试 / 核验 | 验证码或改版时暂停，失败可重试，成功可打开结果页       | ✅   |
| 任务通知           | 成功 / 失败 / 等待处理等系统通知                       | ✅   |
| 自动更新           | GitHub Releases 检查、设置页手动检查、头像上方更新入口 | ✅   |
| 主题               | 跟随系统浅色 / 深色                                    | ✅   |
| 登录时启动         | 系统登录后自动启动，可隐藏到菜单栏                     | ✅   |
| 深度链接           | `mediax://compose` 等协议打开对应页面                  | ✅   |
| Dock / 任务栏      | 快捷菜单、发布进度、待处理角标与提醒                   | ✅   |
| 通知与权限         | 开关、隐私、系统通知权限状态                           | ✅   |
| 日志与诊断         | 查看 / 打开日志，导出本机诊断报告                      | ✅   |
| 桌面安装包         | macOS / Windows / Linux（CI 打 `v*` 标签）             | ✅   |
| 代码签名与公证     | 正式签名、macOS 公证                                   | ⏳   |
| 定时 / 排期发布    | 内容日历、跨平台排期                                   | ⏳   |
| Agent 面           | 独立仓 CLI / Skill / MCP，连接本机桌面                 | ⏳   |

后续桌面能力与排期方向见 [docs/TODO.md](docs/TODO.md)。其余平台编辑器已接入，站点改版后需在对应账号再核对。

## Agent 面

给 Cursor、Claude 等起草文案、创建或调整排期用的机器接口，放在独立仓库 `[csdog/mediax-agent](https://github.com/csdog/mediax-agent)`（与本桌面仓分开维护）。

| 项     | 规划                                                                    |
| ------ | ----------------------------------------------------------------------- |
| 形态   | CLI（命令 `mediax`，别名 `mx`）+ Agent Skill；MCP 为同一套能力的薄封装  |
| 连接   | 本机 loopback HTTP（`127.0.0.1`）+ 本地 token，不经第三方云中转         |
| 桌面侧 | 主进程 **Hono + OpenAPI/Swagger**（契约源）                             |
| CLI 侧 | **Bun compile** 单文件；客户端用 **`@openapi-codegen/typescript`** 生成 |
| 依赖   | **排期发布**与**内容日历**落地后再做可用命令；仓内目前仅为骨架          |

细节与阻塞关系见 [docs/TODO.md](docs/TODO.md)。仓库内 [AGENTS.md](AGENTS.md) 是给写本仓代码的 Agent 看的开发约定，不是上述产品 Agent 面。

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=csdog/mediax&type=Date)

## License

Private / unpublished npm package（`"private": true`）。仓库用途以 GitHub 仓库设置为准。
