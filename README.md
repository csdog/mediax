# media-post

macOS 本地 Facebook 内容工具。Electron + TypeScript + React + TanStack Router / Query + Tailwind CSS + shadcn/ui 官方组件；Drizzle ORM + better-sqlite3 保存 SQLite 业务数据，Drizzle Kit 生成迁移。

## 当前状态

已实现多账号独立会话、个人主页与公共主页身份发现、Markdown 转文本、图文预览、SQLite 草稿、确认发布、串行任务、暂停恢复、失败重试和永久链接核验。关闭账号标签页后，任务会自动重开同一账号的本地会话。

开发版和 arm64 未签名 macOS 打包版均通过离线 Electron 端到端测试，覆盖双会话隔离、持久化、图文发布和防重复提交。真实账号已完成两类身份发现、切换与空白编辑器检查；真实发帖仍需明确的验收内容、图片和目标，尚未执行。实施计划保留在 `.scratch/to-plan/media-post.md`。

## 开发

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run dev
```

开发界面默认使用 `http://127.0.0.1:5186`，可通过 `.env.local` 的 `MAIN_VITE_DEV_SERVER_PORT` 修改；端口被占用时直接报错，不自动切换。Electron 的 CDP 通信端口仍动态分配。

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

## 截图参考布局更新

按用户提供的 Codex 截图调整：44px 贯通顶部工具栏、44px 活动图标栏、224px 列表侧栏、白色主工作区和细分隔线。编辑与预览采用分栏布局，去除后台式大标题和卡片装饰；保留 shadcn 组件和现有业务行为。原生标题栏仍隐藏，macOS 控制按钮及拖动区域保留。

## 仓库位置

Git 与工具配置均位于 `media-post-desktop/`；外层 `media-post/` 仅作为项目容器。开发、测试及打包命令均在本目录执行。

## macOS 桌面能力

关闭主窗口会隐藏到菜单栏，不退出应用。通过菜单栏的「打开主窗口」、Dock 或再次启动应用可以恢复窗口；真正退出使用应用菜单或菜单栏中的「退出 media-post」。

窗口位置、大小和最大化状态保存在 SQLite，外接显示器移除后会调整到可见区域。应用采用单实例，同一用户数据目录不启动第二份任务进程。

应用菜单支持 `⌘N` 编辑内容、`⌘O` 导入 Markdown、`⌘S` 保存草稿、`⌘1/2/3` 切换账号／内容／记录、`⌘W` / `Control+W` 关闭当前标签页、`⌘⇧W` 隐藏窗口、`⌘Q` 退出；标准编辑快捷键也可用。编辑内容不会清空已有草稿。

系统通知接入任务状态变更：成功、失败、人工处理与结果待核验分别提示，点击后跳转发布记录并标记对应任务。不包含正文内容；实际展示受 macOS 通知权限与专注模式影响。发布通知由真实任务状态驱动，待核验不会显示为发布成功。

应用图标采用用户提供的章鱼图片；菜单栏使用同一张桌面图标。其余桌面能力见 [TODO](docs/TODO.md)。

点击左下角头像，在弹出菜单中打开「设置」，可录制、保存或清除全局呼出快捷键，默认 `⌘M`。配置保存在 SQLite，启动时恢复；快捷键冲突时保留原有配置并显示错误。全局快捷键仅在应用运行期间有效。

账号浏览器在主窗口顶部以标签页打开；每个账号保持独立会话，重复打开复用标签页，关闭标签页保留登录数据。最小化快捷键调整为 `⌘⌥M`，避免与全局呼出冲突。

标签页顺序、当前选中的标签页与工作区页面保存在 SQLite，下次启动自动恢复。账号标签页重新加载 Facebook 首页并沿用原登录会话；不恢复未提交的网页编辑器内容。工作区标签页固定保留。

常用标签页快捷键（账号浏览器获得焦点时也有效）：`⌘/Control+T` 新建、`⌘/Control+W` 关闭、`⌘/Control+Shift+T` 重新打开最近关闭的标签页、`Control+Tab` / `Control+Shift+Tab` 前后切换，`⌘/Control+,` 打开设置。重新打开关闭标签页的历史仅在本次运行中保留。完整清单见设置中的「键盘快捷键」。

## Facebook 本地发布

在账号管理打开账号标签页并登录，点击「检查状态」发现个人主页及可管理公共主页。进入「内容发布」填写正文、选择图片与目标，预览后点击发布并确认。受众沿用 Facebook 当前设置。

任务在本机依次执行，图片会复制到任务目录。发布记录分别展示各目标状态和成功链接；登录或安全验证需要人工处理后继续。失败可重试；已提交或结果未知仅核验，不自动重发。提供帖子链接时，会检查作者与内容。

真实账号已验证身份发现与两类空白编辑器，尚未执行真实发帖验收。

## UI 组件基础

shadcn 使用官方 `base-nova`（Base UI）组件，配置位于 `components.json`；应用继续使用已有中性灰白语义 Token 与 Lucide 图标。组件组合采用 Base UI 的 `render` API。弹窗、Popover、Tooltip、HoverCard、Select、Checkbox、Drawer 等交互组件均使用 Base UI；表单组合使用 `useRender`，Toast 使用 Base UI toast manager。已移除直接 Radix 与 Vaul 依赖。

## 渲染进程结构与依赖原则

`src/renderer/src.tsx` 只负责挂载应用与加载样式；页面通过 TanStack Router 的代码路由注册，使用内存 history，兼容开发服务器和打包后的 `file://`。账号浏览器标签页继续由 Electron 管理，会话与标签恢复仍使用 SQLite。

```text
src/renderer/
  src.tsx                     # 应用入口
  app/                        # Router、QueryClient、查询定义、工作区 Context
  pages/                      # 账号、内容发布、发布记录、设置、新标签页、账号浏览器
  components/workspace/       # 工具栏、导航、外壳与页面公共容器
  components/dialogs/         # 工作区公共弹窗
  components/ui/              # 官方 shadcn / Base UI 组件
  hooks/                      # 桌面协调、原生视图布局、预览和快捷键设置
```

TanStack Query 管理账号、发布记录、快捷键设置与标签预览；发布记录每 1.5 秒刷新，由 Query 管理请求生命周期，替代手写定时器。写操作使用 Mutation；发布等副作用关闭自动重试。预览截图仅保存在内存，关闭预览后立即清理对应查询缓存。草稿编辑状态由工作区持有，页面切换和打开设置不会清空正文、图片或目标选择。

通用能力优先使用已有依赖和成熟、维护活跃的 npm 包：路由与数据状态用 TanStack，界面优先组合 shadcn / Base UI，表单与校验可复用已安装的 React Hook Form / Zod，日期处理可复用 date-fns。新增依赖前检查现有依赖是否已满足需要；业务规则、Electron 原生视图协调与 Facebook 平台适配保留在项目代码中。避免为简单局部逻辑引入不必要依赖，也避免重复实现成熟库已有的能力。

## SQLite 与数据库迁移

表定义集中在 `src/main/storage/schema.ts`；`Database.ts` 使用 Drizzle 的类型安全查询、JSON 字段映射与事务，底层继续使用 better-sqlite3，并保留外键约束和 WAL。草稿仅保存图片路径及名称，预览仍在加载时生成。

```sh
# 修改 schema.ts 后生成 SQL 迁移及快照
mise exec -- pnpm run db:generate --name=describe_change
# 检查迁移历史是否存在冲突
mise exec -- pnpm run db:check
```

`drizzle.config.ts` 配置 SQLite、schema 路径与 `drizzle/` 输出目录，不绑定用户数据库。提交时同时包含生成的 SQL、`meta/_journal.json` 和 schema 快照。`db:check` 只检查迁移历史一致性，实际执行由自动化测试验证。

应用在打开数据库时调用官方 better-sqlite3 migrator，按 `__drizzle_migrations` 执行尚未应用的迁移；迁移失败会回滚并停止打开数据库。迁移文件随桌面包进入 `app.asar/drizzle`，主进程通过自身模块位置定位，不依赖启动时的工作目录。Drizzle Kit 只作为开发依赖，应用运行时不调用 CLI。

初始迁移 `0000_legacy_baseline.sql` 由 Kit 生成，针对已有 v1/v2 数据库将建表语句调整为 `IF NOT EXISTS`，保留原表和记录，并补齐 v1 缺少的 settings 表。此基线只完成既有数据库接管，不重建表；旧库主键原有的可空属性保持不变，新库按 Drizzle 定义建立非空主键。`user_version=3` 标记接管完成，阻止旧应用误读；后续结构版本以 Drizzle 迁移历史为准。启动时拒绝高于本应用的旧版本号或 Drizzle 迁移记录。已有迁移发布后不可修改；后续改表应生成新的迁移。不要对真实用户数据库运行 `drizzle-kit push`。

迁移测试使用独立的原版 v1 SQL fixture，覆盖 v1/v2 账号、图片草稿、任务、目标、尝试记录与设置保留，重复启动不重复迁移、失败回滚、防降级以及中断任务恢复。

## 窗口外框与原生材质

已依据本机 Codex 安装包静态样式与窗口代码修正分层：macOS 使用 menu 材质，失焦切换实色；外框、圆角页面底板、侧栏与白色内容区分别绘制。当前原生材质与界面统一为浅色。其他平台使用中性实色回退，尚未实机验收。详见 [窗口实现与静态依据](docs/window-chrome.md)。

## 环境配置与日志

使用 electron-vite 原生 `.env` 加载机制，不额外实现 dotenv 加载器。配置从项目根目录读取，渲染进程虽位于 `src/renderer`，也使用同一目录。

| 文件                               | 作用                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| `.env`                             | 开发、生产共用的非敏感默认值                                        |
| `.env.development`                 | `pnpm dev` 使用，console 和 file 默认为 debug                       |
| `.env.production`                  | `pnpm build` / `pnpm package:mac` 使用，console 和 file 默认为 info |
| `.env.local` / `.env.[mode].local` | 本机覆盖配置，Git 已忽略                                            |

优先级从高到低：启动命令已有环境变量、`.env.[mode].local`、`.env.[mode]`、`.env.local`、`.env`。修改后重启开发命令；生产配置在构建时写入应用，修改源 `.env.production` 后需重新构建／打包。已安装应用不会从当前工作目录寻找 `.env`。

| 配置项                      | 默认值／用途                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `MAIN_VITE_DEV_SERVER_PORT` | `5186`，开发服务器端口，1024–65535                             |
| `VITE_LOG_CONSOLE_LEVEL`    | 开发 debug、生产 info；主进程 console 和渲染进程 DevTools 等级 |
| `MAIN_VITE_LOG_FILE_LEVEL`  | 开发 debug、生产 info；文件等级                                |
| `MAIN_VITE_LOG_MAX_SIZE`    | `5242880`（5 MiB）；单文件轮转阈值，1024–104857600 字节        |

等级可用 `error`、`warn`、`info`、`verbose`、`debug`、`silly`；值为 `false` 时关闭对应输出。日志等级无效或轮转大小越界会报错。示例 `.env.development.local`：

```dotenv
MAIN_VITE_DEV_SERVER_PORT=5187
VITE_LOG_CONSOLE_LEVEL=debug
MAIN_VITE_LOG_FILE_LEVEL=info
MAIN_VITE_LOG_MAX_SIZE=10485760
```

环境变量通过 `import.meta.env` 访问：`MAIN_VITE_` 仅主进程、`PRELOAD_VITE_` 仅 preload、`RENDERER_VITE_` 仅渲染进程、`VITE_` 三者共享。不要在共享或渲染变量中放凭据；桌面包内的主进程配置也可被提取，长期密钥不能依赖客户端环境文件保密。

日志使用 `electron-log`，主进程和应用渲染进程的 `console.log/info/warn/error/debug` 同时接入 console 与文件，保留原生 console API 使用方式。未捕获异常、未处理 Promise rejection、应用启动／退出、主界面加载／异常、IPC 调用失败、发布目标状态变化均会记录。业务日志不主动输出发布正文、图片预览、Cookie 或密码；不要向 logger 传入敏感数据。

开发模式（`pnpm dev`）写到项目目录 `logs/main.log`。生产构建和安装包写到应用数据目录 `<userData>/logs/main.log`，默认 macOS 路径：

```text
~/Library/Application Support/media-post/logs/main.log
```

达到阈值后由 electron-log 轮转为 `main.old.log`，只保留一个旧文件；阈值在写入时检查，不是每条消息的硬截断。生产模式测试传入 `MEDIA_POST_USER_DATA` 时，日志随测试数据目录隔离。日志包含带本地时区偏移的时间、大写等级、进程来源与异常堆栈。控制台里的等级按级别着色：错误红色、警告黄色、信息青色、调试灰色。文件日志保持纯文本。

主进程使用 `import { log } from "./logging"`；渲染进程可使用 `import log from "electron-log/renderer"`，也可沿用 console。库的 preload 桥仅打包进应用自己的 sandbox preload，不向 Facebook 账号会话注入脚本，不收集远程网页 console。

实现依据：[electron-log](https://github.com/megahertz/electron-log)、[electron-vite 环境变量与模式](https://electron-vite.org/guide/env-and-mode)。
