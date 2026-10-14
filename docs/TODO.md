# 桌面能力 TODO

首版已实施：菜单栏图标、关闭主窗口后隐藏、任务状态通知、单实例唤起、SQLite 窗口位置与尺寸记忆、应用菜单及窗口内快捷键、可配置的全局呼出快捷键。

后续再做：

- [x] **Dock 右键快捷菜单、任务进度、角标和需要处理时的提醒**：Dock / 托盘快捷入口；进行中任务显示进度条；`awaiting_user` 数量作角标，并 bounce / 闪烁任务栏。
- [x] **拖入 Markdown／图片、文件关联、在 Finder 中显示素材**：内容区可拖入 `.md`/图片/音视频；安装包关联常见扩展；素材缩略图可「在 Finder 中显示」。
- [x] `mediax://` **深度链接**：打开 compose / accounts / video / history / settings；`history/<taskId>` 可定位任务。
- [x] **登录时启动**：设置 → 常规可开关；系统登录后自动启动，从登录项启动时默认隐藏到菜单栏。
- [x] **自动更新**：已接入 `electron-updater`（GitHub Releases、启动后后台检查、设置页手动检查 / 重启安装）。仍待：正式代码签名与 macOS 公证（未签名包在部分系统上更新可能受限）。
- [x] **外观设置中的主题模式**：设置 → 外观可选浅色 / 深色 / 跟随系统；`nativeTheme` 与渲染层 `.dark` 同步，偏好持久化。
- [x] **Electron 性能清单（官方 Performance tutorial）**：ready 前清空默认菜单；主窗口 / 账号视图关闭 spellcheck；首屏后再跑账号同步与更新检查；懒加载 `playwright-core` / `electron-updater`；CDP 就绪与窗口加载并行；单实例冲突用 `app.exit(0)` 避免启动期 SIGTRAP。
- [x] **对标 VS Code / Codex 的性能措施**：`v8CacheOptions: bypassHeatCheck`；版本升级清 code cache；`Starting → Restored → Eventually` 生命周期；`mediax/*` 启动埋点；素材 / Markdown 导入进 UtilityProcess（失败回退主进程）。
- [ ] 断网、休眠和唤醒后的任务处理。
- [x] **用户可查看或导出的故障日志及诊断信息**：设置 → 存储可预览日志末尾、打开日志文件、导出诊断报告（不含正文 / Cookie）。
- [x] **通知开关、通知隐私和系统权限状态展示**：可关总开关 / 发布结果 / 人工处理；隐私模式隐藏目标名；展示系统通知权限并跳转系统设置。

业务待办见 [implementation-status.md](implementation-status.md)。发布已覆盖文章、动态、视频和音频；未列入能力表的平台仍只有登录。

## 排期与自动化（对标 Postiz，后续）

首版不做定时发布；以下能力记为后续产品方向（参考 [Postiz](https://github.com/gitroomhq/postiz-app) 一类工具，实现时需评估官方 API vs 本机 RPA 的取舍）。

- [ ] **多平台排期发布**：写一次内容，按日历安排发到 X、LinkedIn、Instagram、Facebook、TikTok、YouTube、Threads、Bluesky、Mastodon、Discord 等（优先官方 OAuth / API；国内无开放 API 的平台仍走本机会话）。
- [ ] **内容日历**：按天 / 周查看排期，拖拽改时间，跨账号统一管理。
- [ ] **数据分析**：账号与作品维度的阅读、互动等汇总（各平台数据源与权限单独接入）。
- [ ] **自动化接入**：Public API、n8n / Make、SDK。
- [ ] **Agent 面**（独立仓 [`csdog/mediax-agent`](https://github.com/csdog/mediax-agent)）：CLI（`mediax` / 别名 `mx`）+ Skill，MCP 为同一套能力的薄封装；经本机 loopback HTTP + token 连接桌面。选型：桌面主进程 **Hono + OpenAPI/Swagger**；CLI **Bun compile** + **`@openapi-codegen/typescript`**。业务发布/排期命令仍 **blocked by** 上方「多平台排期发布」与「内容日历」。桌面已提供控制面骨架：`GET /health`、`GET /doc`、写入 `~/.mediax/control.json`（供 agent `doctor`）。
