# mediax UI 规范

布局、字体和圆角以用户确认的 Codex 截图规范为准；配色按 2026-10-12 实际读取的 ChatGPT 网页浅色样式调整。界面使用 shadcn/ui，图标仅使用 Lucide，样式集中在 src/renderer/style.css 的语义 Token 中。

- 布局：44px 顶栏、44px 活动栏、224px 次级侧栏、白色内容区；分栏以 1px 细线分隔。
- 颜色：主区域与侧栏 #FCFCFC，输入面板 #FFFFFF，外壳与 Hover #F2F2F2，选中 #EEEEEE，文字 #0D0D0D，次级 #5D5D5D，提示 #8F8F8F；分隔线使用 10% 黑色，输入边框 16%。主按钮 #0D0D0D；蓝色仅保留给焦点与链接。
- 圆角：侧栏与工作区外侧边角 24px，内部连续分区和分隔线保持平直；按钮和导航 12px，输入 14px，弹出菜单 20px，对话框 24px，编辑输入面板 28px，头像 50%。
- 图标：20px、描边 1.65px；无文字操作提供 Tooltip 和可访问名称。
- 字号：`-apple-system-body` 系统字体，字重 430。界面、导航和按钮 13px，辅助文字 12px，编辑框和预览正文 16px，标题 18px。正文行高 24px，界面行高 18px，辅助文字 16px，标题 24px。
- 不使用玻璃模糊；普通面板无阴影，编辑输入面板及弹层使用轻微阴影；遮罩黑色 25%。
- 交互动画 150ms；分别定义 Hover、选中、键盘焦点和禁用状态。强调蓝用于焦点和重要操作。

内容编辑使用底部输入面板，右侧为预览与发布目标。账号、内容、记录共用同一套桌面外壳和控件规则。业务状态仍以实现为准，未验证的发布功能保持禁用。

## 网页样式核对

参考 https://chatgpt.com/ 的当前浅色界面。仅检查可见元素的 computed style 与样式表颜色声明，不读取对话内容。

- 可见 MAIN、ASIDE 背景为 `oklch(0.991069 0 none)`，对应 `#FCFCFC`。
- 主文字 `oklch(0.159066 0 none)` / `#0D0D0D`；次级文字 `oklch(0.478359 0 none)` / `#5D5D5D`。
- 样式表的 secondary / tertiary surface 为 `#F2F2F2` / `#EEEEEE`，tertiary text 为 `#8F8F8F`。
- 输入 FORM 背景为白色，使用 10% 黑色边框和 4% / 4% / 2.4% 的三层轻阴影。
- 网页没有 Electron 标题栏；桌面工具栏与活动栏沿用网页 secondary surface，是本项目的布局适配。

## 地址栏历史建议行高

历史记录与搜索建议的整行高度为 **36px**，文字使用 13px 字号、1.5 倍行高（19.5px）并垂直居中，弹窗最大高度保持 320px。

依据本机 Codex `26.1007.71326`（`/Applications/ChatGPT.app`，Bundle ID `com.openai.codex`）安装包的只读静态检查：`app.asar/webview/assets/input-8a7c13b06d15.js` 的浏览器地址栏导入 `popup-6377544fab47.js` 中的共享建议列表；该列表的条目按钮使用 `flex h-9 ... items-center ... text-[13px]`。`app-shared-6ed15bfa827c.css` 定义 `.h-9{height:calc(var(--spacing) * 9)}`，基础间距为 4px，因此整行是 36px。这里核对的是安装包样式，不是运行时测量。

同一安装包的地址建议列表还使用 `p-1 rounded-xl`，条目按钮使用 `gap-2.5 px-2.5 pe-9 rounded-lg text-[13px]`。按 4px 基础间距，列表内边距为 4px，图标与文字间距 10px，条目起始内边距 10px，末尾为删除操作预留 36px；图标为 16px。标题、分隔符和网址是 `items-baseline gap-1` 的单行布局，间距 4px，标题最大宽度 60%，标题和网址分别截断。

字体沿用桌面默认系统字体栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`，13px、字重 430，继承 1.5 倍文字行高。圆角必须考虑安装包中 `:root` 的 `--codex-corner-radius-scale:1.25`：`rounded-xl` 的基础半径 12px，桌面实际为 15px；`rounded-lg` 基础半径 10px，桌面实际为 12.5px；网站图标 `rounded-2xs` 基础半径 2px，桌面实际为 2.5px。浏览器模式的系数为 1，本项目对齐的是桌面默认值。以上基础变量与选择器均来自 `app-shared-6ed15bfa827c.css`，建议内容的图标与文本布局来自 `app-shared-8340f229c2b3.js` 的 `zVi` 函数。账号头像是 MediaX 自有信息，继续保留。

删除操作同样按共享列表对齐：按钮定位 `end-2.5`（距行末 10px），`iconCircleSm` 映射为 `size-5`（20px），`radius:"small"` 映射为 `rounded-md`，桌面实际圆角为 10px；删除图形使用 16px 资源。映射来自 `app-shared-8340f229c2b3.js` 的按钮尺寸与圆角表。搜索建议沿用同一条目按钮的左右内边距，右侧同样保留 36px。
