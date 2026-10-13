export const DEFAULT_GLOBAL_SHORTCUT = "CommandOrControl+M";

export type ShortcutScope = "global" | "app";

export type ShortcutEntry = {
  id: string;
  title: string;
  description: string;
  /** Electron accelerator default (CommandOrControl / Control+Tab 等). */
  accelerator: string;
  scope: ShortcutScope;
};

export const shortcutCatalog: ShortcutEntry[] = [
  {
    id: "global-show",
    title: "全局呼出",
    description: "应用运行时，即使窗口隐藏也能呼出主窗口。",
    accelerator: DEFAULT_GLOBAL_SHORTCUT,
    scope: "global",
  },
  {
    id: "new-tab",
    title: "新建标签页",
    description: "打开一个新的工作区标签页。",
    accelerator: "CommandOrControl+T",
    scope: "app",
  },
  {
    id: "close-tab",
    title: "关闭当前标签页",
    description: "关闭活动标签页；不会退出应用。",
    accelerator: "CommandOrControl+W",
    scope: "app",
  },
  {
    id: "reopen-tab",
    title: "重新打开关闭的标签页",
    description: "恢复最近关闭的标签页。",
    accelerator: "CommandOrControl+Shift+T",
    scope: "app",
  },
  {
    id: "next-tab",
    title: "下一个标签页",
    description: "切换到右侧标签页。",
    accelerator: "Control+Tab",
    scope: "app",
  },
  {
    id: "previous-tab",
    title: "上一个标签页",
    description: "切换到左侧标签页。",
    accelerator: "Control+Shift+Tab",
    scope: "app",
  },
  {
    id: "settings",
    title: "打开设置",
    description: "打开应用设置页。",
    accelerator: "CommandOrControl+,",
    scope: "app",
  },
  {
    id: "compose",
    title: "编辑内容",
    description: "进入内容发布页并开始创作。",
    accelerator: "CommandOrControl+N",
    scope: "app",
  },
  {
    id: "save-draft",
    title: "保存草稿",
    description: "将当前正文与素材保存到本机。",
    accelerator: "CommandOrControl+S",
    scope: "app",
  },
  {
    id: "import-markdown",
    title: "导入 Markdown",
    description: "从本地文件导入 Markdown 正文。",
    accelerator: "CommandOrControl+O",
    scope: "app",
  },
  {
    id: "accounts",
    title: "账号管理",
    description: "打开账号管理页。",
    accelerator: "CommandOrControl+1",
    scope: "app",
  },
  {
    id: "compose-page",
    title: "内容发布",
    description: "打开内容发布页。",
    accelerator: "CommandOrControl+2",
    scope: "app",
  },
  {
    id: "video",
    title: "视频",
    description: "打开视频发布页。",
    accelerator: "CommandOrControl+3",
    scope: "app",
  },
  {
    id: "history",
    title: "发布记录",
    description: "打开发布记录页。",
    accelerator: "CommandOrControl+4",
    scope: "app",
  },
  {
    id: "hide-window",
    title: "隐藏窗口",
    description: "关闭主窗口后隐藏到菜单栏，任务继续运行。",
    accelerator: "CommandOrControl+Shift+W",
    scope: "app",
  },
];

export const defaultShortcutMap = (): Record<string, string> =>
  Object.fromEntries(shortcutCatalog.map((item) => [item.id, item.accelerator]));

export function shortcutEntry(id: string) {
  return shortcutCatalog.find((item) => item.id === id);
}

export function formatAccelerator(accelerator: string) {
  if (!accelerator) return "";
  return accelerator
    .replace(/CommandOrControl|CmdOrCtrl/g, "⌘")
    .replace(/Command|Cmd/g, "⌘")
    .replace(/Control|Ctrl/g, "⌃")
    .replace(/Alt|Option/g, "⌥")
    .replace(/Shift/g, "⇧")
    .replace(/Space/g, "空格")
    .replace(/Tab/g, "Tab")
    .replace(/\+/g, "");
}

const KEY_PATTERN =
  "(?:[A-Za-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Tab|Space|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter|Up|Down|Left|Right|,|\\[|\\]|\\\\|;|'|`|=|-)";

function currentPlatform(): NodeJS.Platform {
  if (typeof process !== "undefined" && typeof process.platform === "string") {
    return process.platform;
  }
  if (typeof navigator !== "undefined") {
    const hint = `${navigator.platform} ${navigator.userAgent}`;
    if (/Mac|iPhone|iPad|iPod/i.test(hint)) return "darwin";
    if (/Win/i.test(hint)) return "win32";
    return "linux";
  }
  return "darwin";
}

export function normalizeAccelerator(accelerator: string, platform = currentPlatform()) {
  return accelerator
    .trim()
    .replace(/CommandOrControl|CmdOrCtrl/g, platform === "darwin" ? "Command" : "Control")
    .replace(/\bCmd\b/g, "Command")
    .replace(/\bCtrl\b/g, "Control")
    .replace(/\bOption\b/g, "Alt")
    .replace(/\bMeta\b|\bSuper\b/g, "Command");
}

export function isValidAccelerator(accelerator: string) {
  if (!accelerator) return true;
  if (accelerator.length > 100) return false;
  const normalized = accelerator
    .trim()
    .replace(/CommandOrControl|CmdOrCtrl/g, "Command")
    .replace(/\bCmd\b/g, "Command")
    .replace(/\bCtrl\b/g, "Control")
    .replace(/\bOption\b/g, "Alt");
  if (
    !/(?:^|\+)(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|Super|Meta)\+/.test(
      accelerator.trim(),
    )
  )
    return false;
  return new RegExp(
    `^(?:(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|Shift|Super|Meta)\\+)+${KEY_PATTERN}$`,
  ).test(normalized);
}

export function acceleratorFromKeyboardEvent(event: KeyboardEvent): string | { error: string } {
  if (["Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key))
    return { error: "请继续按下字母或数字键。" };
  // Allow Control/Cmd/Alt+Tab through; plain Tab moves focus.
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return { error: "请同时按住修饰键后再按 Tab。" };
  }
  if (!event.metaKey && !event.ctrlKey && !event.altKey)
    return { error: "请同时按住 Command、Control 或 Option。" };
  const key =
    event.code === "Space"
      ? "Space"
      : event.code === "Tab" || event.key === "Tab"
        ? "Tab"
        : event.code === "Comma" || event.key === ","
          ? ","
          : /^Key[A-Z]$/.test(event.code)
            ? event.code.slice(3)
            : /^Digit[0-9]$/.test(event.code)
              ? event.code.slice(5)
              : event.key.length === 1
                ? event.key
                : event.key.replace(/^Arrow/, "");
  if (
    !/^(?:[A-Za-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter|Up|Down|Left|Right|,|\[|\]|\\|;|'|`|=|-)$/.test(
      key,
    )
  )
    return { error: "暂不支持这个按键，请换一个组合。" };
  return [
    event.metaKey && "Command",
    event.ctrlKey && "Control",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

export function mergeShortcutMap(saved: unknown): Record<string, string> {
  const defaults = defaultShortcutMap();
  if (!saved || typeof saved !== "object") return defaults;
  const next = { ...defaults };
  for (const [id, value] of Object.entries(saved as Record<string, unknown>)) {
    if (!(id in defaults)) continue;
    if (typeof value === "string") next[id] = value;
  }
  return next;
}
