# 窗口外壳、材质与颜色

参考本机 `/Applications/ChatGPT.app`（Bundle ID `com.openai.codex`，产品名 Codex，版本 `26.1007.30912`）。以下是安装包静态观察及 media-post 的实现选择；未读取运行中 Codex 的 DOM，也未验证其当前主题设置。

## 安装包中观察到的行为

- 主进程 `.vite/build/main-CqEoQDOU.js` 的主窗口选项使用 macOS `menu` vibrancy。失焦判定 `E1e` 对普通 macOS 窗口返回不透明模式；`L9` 在该模式下选择浅色 `#f9f9f9`／深色 `#000000`，透明模式选择 `#00000000`；`k1e` 在不透明模式移除 vibrancy。焦点、失焦、显示与隐藏通知会重新计算外观。因此，激活与失焦的差异包含应用主动切换，并非完全由 macOS 自动生成。
- 同一主进程对 Windows 透明模式选择 Mica，不透明模式选择 `none`。macOS 另有窗口尺寸、用户不透明选项等分支，不能将一种截图外观当作所有配置的默认值。
- `app-shared-9a94b907ed47.css` 定义中性基础色：gray-fixed-0 为 `#fff`，gray-fixed-50 为 `#f9f9f9`，gray-fixed-100 为 `#ededed`。Electron 根和 body 可保持透明；不透明模式使用 surface-under。外壳、页面底板和导航拥有不同的混色层，而不是整页设置 opacity。
- 浅色 editor-opaque 在支持 color-mix 时使用 `#ededed` 的 40% 混色，frame 进一步取该颜色的 70%；对应同色透明合成约为 28%。page-surface 使用 surface-secondary 的 85%；页面侧栏导航再覆盖 surface 的 65%。这些是代码中的样式规则，当前运行界面是否启用相应布局和主题尚未验证。
- `app-initial-99e8b4b455fa.css` 区分 PageSurface、MainContentSurface 与 Sidebar；基础面板圆角 `--radius-xl-base` 为 `.75rem`，有侧栏时内容区内侧接缝取消圆角。内容面板使用不透明 surface，圆角处露出底层外壳。

## media-post 实现

`src/main/desktop/windowBackdrop.ts` 管理原生背景：macOS 获得焦点时启用 menu 材质，失焦时移除材质并使用 `#f9f9f9`。系统要求减少透明度时使用实色。以 BrowserWindow 焦点为准，避免账号 WebContentsView 获取输入焦点时误判。显示、隐藏和原生主题更新也会同步背景，关闭窗口后移除原生主题监听。

`nativeTheme.themeSource` 为 `system`，与系统浅色／深色一致。失焦实色背景浅色为 `#f9f9f9`、深色为 `#000000`；渲染层通过 `.dark` 与 `prefers-color-scheme` 切换语义 Token（含外壳 `--chrome` / `--page-surface` 等）。

渲染层采用共享外壳：28% 中性灰外壳、85% 浅灰圆角底板、65% 白色侧栏导航和不透明白色内容区。顶部与活动栏露出外壳；侧栏与主工作区共享一个底板。面板圆角 24px、右侧和底部留白 8px 是本项目的布局选择；不是宣称恢复了 Codex 所有布局模式的精确参数。设置页使用同一留白与圆角，导航背景为 surface-under。

只有 macOS 的 HTML 根允许透出原生材质。Windows、Linux 与普通浏览器保留 `#f9f9f9` 实色基底，使用同一组中性灰分层，避免透明区域意外露出系统默认色。目前未在 Windows/Linux 实机验证，亦未接入 Windows Mica；首版仍只支持 macOS。原生材质的最终颜色会受背景、系统版本及辅助功能设置影响，不能保证各平台逐像素一致。

顶部保留原有 drag/no-drag 区域，面板底板不接收鼠标事件。内嵌账号页继续按 DOM 内容区域确定原生视图边界，并保留其圆角裁切。

## 静态证据与覆盖范围

REA 6.4.0 对选定的窗口及外壳文件生成 Evidence：`ev_4218c6181a8d3b2a9373fbe4e1a19fd0e5139f1822e9d97204b61ca32ef0b073`。主进程的语义分析达到内存限制，图不完整；上述具体颜色与条件另外通过只读 ASAR 提取、限定文本检查确认，不声称 REA 完整还原了主进程。没有启动、修改或注入 Codex。

可复核的源文件 SHA-256：

- `.vite/build/main-CqEoQDOU.js`: `09d19386e1f23cf4ccbc950fc40d85a1e8a064a08be588b2a4be6a89f6ada9e6`
- `webview/assets/app-shared-9a94b907ed47.css`: `69f929f71947824fed18365d54c8aa0c975a856649339e585a50f6f547e215d7`
- `webview/assets/app-initial-99e8b4b455fa.css`: `1a75f9180b89d2457dc09e4efea288436c9cf6d44e5ba59b2c03d3d571b7bf61`

主进程字符偏移（UTF-8 解码后）：颜色常量约 `3716638`，失焦策略约 `3750056`，背景／材质选择约 `3750573`，focus/blur/show/hide 注册约 `3735590`。安装包升级后路径、哈希和偏移可能变化。

Electron API 依据：[BaseWindow 文档](https://www.electronjs.org/docs/latest/api/base-window)、[BrowserWindow 文档](https://www.electronjs.org/docs/latest/api/browser-window)。验证范围与实际结果随本次改动说明提供。
