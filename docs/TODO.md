# 桌面能力 TODO

首版已实施：菜单栏图标、关闭主窗口后隐藏、任务状态通知、单实例唤起、SQLite 窗口位置与尺寸记忆、应用菜单及窗口内快捷键、可配置的全局呼出快捷键。

后续再做：

- [ ] Dock 右键快捷菜单、任务进度、角标和需要处理时的提醒。
- [ ] 拖入 Markdown／图片、文件关联、在 Finder 中显示素材。
- [ ] `media-post://` 深度链接。
- [ ] 登录时启动。
- [ ] **自动更新**：接入 `electron-updater`（或同类方案），从 GitHub Releases 检查 / 下载 / 安装更新；支持手动「检查更新」与后台静默检查；覆盖 macOS / Windows / Linux 产物；含代码签名与 macOS 公证前置。
- [ ] 跟随系统浅色／深色主题。
- [ ] 断网、休眠和唤醒后的任务处理。
- [ ] 用户可查看或导出的故障日志及诊断信息。
- [ ] 通知开关、通知隐私和系统权限状态展示。

业务待办见 [implementation-status.md](implementation-status.md)。发布已覆盖文章、动态、视频和音频；未列入能力表的平台仍只有登录。

## 排期与自动化（对标 Postiz，后续）

首版不做定时发布；以下能力记为后续产品方向（参考 [Postiz](https://github.com/gitroomhq/postiz-app) 一类工具，实现时需评估官方 API vs 本机 RPA 的取舍）。

- [ ] **多平台排期发布**：写一次内容，按日历安排发到 X、LinkedIn、Instagram、Facebook、TikTok、YouTube、Threads、Bluesky、Mastodon、Discord 等（优先官方 OAuth / API；国内无开放 API 的平台仍走本机会话）。
- [ ] **内容日历**：按天 / 周查看排期，拖拽改时间，跨账号统一管理。
- [ ] **数据分析**：账号与作品维度的阅读、互动等汇总（各平台数据源与权限单独接入）。
- [ ] **自动化接入**：Public API、n8n / Make、SDK。
- [ ] **Agent 面**：MCP / CLI，方便用 Cursor、Claude 等起草文案并创建或调整排期。
