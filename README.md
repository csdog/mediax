# media-post

macOS 本地 Facebook 内容工具。Electron + TypeScript + React + Tailwind CSS + shadcn/ui 官方组件；SQLite（better-sqlite3）保存业务数据。

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

开发界面固定使用 `http://127.0.0.1:5186`；端口被占用时直接报错，不自动切换。Electron 的 CDP 通信端口仍动态分配。

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

关闭主窗口会隐藏到菜单栏，不退出应用。通过菜单栏的「打开主窗口」、Dock 或再次启动应用可以恢复窗口；真正退出使用应用菜单或菜单栏中的「退出 media-post」。存在未完成／待核验任务时退出会提示确认。

窗口位置、大小和最大化状态保存在 SQLite，外接显示器移除后会调整到可见区域。应用采用单实例，同一用户数据目录不启动第二份任务进程。

应用菜单支持 `⌘N` 编辑内容、`⌘O` 导入 Markdown、`⌘S` 保存草稿、`⌘1/2/3` 切换账号／内容／记录、`⌘W` / `Control+W` 关闭当前标签页、`⌘⇧W` 隐藏窗口、`⌘Q` 退出；标准编辑快捷键也可用。编辑内容不会清空已有草稿。

系统通知接入任务状态变更：成功、失败、人工处理与结果待核验分别提示，点击后跳转发布记录并标记对应任务。不包含正文内容；实际展示受 macOS 通知权限与专注模式影响。发布通知由真实任务状态驱动，待核验不会显示为发布成功。

应用图标采用用户提供的章鱼图片；菜单栏使用单色发布标记，适配系统明暗背景。其余桌面能力见 [TODO](docs/TODO.md)。

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
