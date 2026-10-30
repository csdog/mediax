# 桌面与发布 TODO

新增事项放入对应的待办分类；完成后勾选并移入 **Archive / 已完成**。明确暂缓或取消的事项移入 **Archive / 暂缓或取消**，注明原因，保留历史记录。

业务能力详情见 [implementation-status.md](implementation-status.md)。发布已覆盖文章、动态、视频和音频；未列入能力表的平台仍只有登录。

## 待办

### 桌面与稳定性

- [ ] **正式代码签名与 macOS 公证**：自动更新已接入，但未签名包在部分系统上更新可能受限。

### 排期与自动化

参考 [Postiz](https://github.com/gitroomhq/postiz-app) 一类工具；实现时评估官方 API 与本机 RPA 的取舍。

- [ ] **自动化接入**：Public API、n8n / Make、SDK。

## Archive

### 已完成 · 发布体验

- [x] **保存并复用发布配置**：创作页的「发布方案」按内容类型保存账号、发布身份及静默、并发、限速设置，支持应用和删除；失效身份会阻止应用并提示刷新。方案保存在本机，重启后保留；不保存标题、正文、素材或具体定时时间。

### 已完成 · 桌面能力

- [x] **断网、休眠和唤醒后的任务处理**：断网或休眠时暂停领取目标，恢复后继续等待中的任务；唤醒后立即补查过期排期。已中断的准备流程在恢复后也必须人工确认，可能已经提交的目标保留待核验，不自动重发。
- [x] **首版桌面基础能力**：菜单栏图标、关闭主窗口后隐藏、任务状态通知、单实例唤起、SQLite 窗口位置与尺寸记忆、应用菜单及窗口内快捷键、可配置的全局呼出快捷键。
- [x] **Dock 右键快捷菜单、任务进度、角标和需要处理时的提醒**：Dock / 托盘快捷入口；进行中任务显示进度条；`awaiting_user` 数量作角标，并 bounce / 闪烁任务栏。
- [x] **拖入 Markdown / 图片、文件关联、在 Finder 中显示素材**：内容区可拖入 `.md` / 图片 / 音视频；安装包关联常见扩展；素材缩略图可「在 Finder 中显示」。
- [x] **`mediax://` 深度链接**：打开 compose / accounts / video / history / settings；`history/<taskId>` 可定位任务。
- [x] **登录时启动**：设置 → 常规可开关；系统登录后自动启动，从登录项启动时默认隐藏到菜单栏。
- [x] **自动更新**：已接入 `electron-updater`，使用 GitHub Releases，支持启动后后台检查、设置页手动检查和重启安装；签名与公证单独列为待办。
- [x] **外观设置中的主题模式**：设置 → 外观可选浅色 / 深色 / 跟随系统；`nativeTheme` 与渲染层 `.dark` 同步，偏好持久化。
- [x] **Electron 性能清单**：ready 前清空默认菜单；主窗口关闭拼写检查，账号页为原生拼写菜单显式启用；首屏后再跑账号同步与更新检查；懒加载 `playwright-core` / `electron-updater`；CDP 就绪与窗口加载并行；单实例冲突用 `app.exit(0)` 避免启动期 SIGTRAP。
- [x] **对标 VS Code / Codex 的性能措施**：`v8CacheOptions: bypassHeatCheck`；版本升级清 code cache；`Starting → Restored → Eventually` 生命周期；`mediax/*` 启动埋点；素材 / Markdown 导入进 UtilityProcess（失败回退主进程）。
- [x] **故障日志与诊断信息**：设置 → 存储可预览日志末尾、打开日志文件、导出诊断报告，不含正文 / Cookie。
- [x] **通知开关、通知隐私和系统权限状态**：可关总开关 / 发布结果 / 人工处理；隐私模式隐藏目标名；展示系统通知权限并跳转系统设置。

### 已完成 · 排期与分析

- [x] **多平台排期发布（本机）**：创作页可选定时；`scheduled` → 到点入队；需应用保持运行，非官方 OAuth 云排期。
- [x] **内容日历**：周视图查看排期 / 已发，已排期可改期（`mediax://calendar`）。
- [x] **数据分析（本机汇总）**：按平台 / 账号汇总发布量与成功率等；不抓站外阅读 / 点赞（`mediax://analytics`）。

### 已完成 · Agent 面

- [x] **Agent 面**（独立仓 [`csdog/mediax-agent`](https://github.com/csdog/mediax-agent)）：本机控制面接通账号、发布、排期、日历和任务处理；CLI + Skill 消费生成的 OpenAPI 客户端。接口和命令见 [control-api.md](control-api.md)。

### 暂缓或取消

暂无。后续归档时注明暂缓或取消的原因。
