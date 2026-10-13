import type { Input } from "electron";
import type { TabAction } from "../../shared/models";
import { defaultShortcutMap, normalizeAccelerator } from "../../shared/shortcutCatalog";

const tabActions = {
  "new-tab": "new",
  "close-tab": "close",
  "reopen-tab": "reopen",
  "next-tab": "next",
  "previous-tab": "previous",
  settings: "settings",
} as const satisfies Record<string, TabAction | "settings">;

function inputKey(input: Pick<Input, "key">) {
  const key = input.key;
  if (key === " ") return "Space";
  if (key.length === 1) return key.toLowerCase() === key.toUpperCase() ? key : key.toUpperCase();
  if (key.startsWith("Arrow")) return key.slice(5);
  return key;
}

function matchesAccelerator(
  input: Pick<Input, "key" | "control" | "meta" | "shift" | "alt">,
  accelerator: string,
  platform: NodeJS.Platform,
) {
  if (!accelerator) return false;
  const flexible = /CommandOrControl|CmdOrCtrl/.test(accelerator);
  const parts = normalizeAccelerator(accelerator, platform).split("+");
  const key = parts.at(-1);
  if (!key) return false;
  const mods = new Set(parts.slice(0, -1));
  const wantAlt = mods.has("Alt");
  const wantShift = mods.has("Shift");
  if (Boolean(input.alt) !== wantAlt) return false;
  if (Boolean(input.shift) !== wantShift) return false;
  if (flexible) {
    if (!input.control && !input.meta) return false;
  } else {
    if (Boolean(input.control) !== mods.has("Control")) return false;
    if (Boolean(input.meta) !== mods.has("Command")) return false;
  }
  const pressed = inputKey(input);
  if (key === "Tab") return pressed.toLowerCase() === "tab";
  if (key === ",") return pressed === ",";
  if (key === "Space") return pressed === "Space";
  return pressed.toLowerCase() === key.toLowerCase();
}

export function tabShortcut(
  input: Pick<Input, "type" | "key" | "control" | "meta" | "shift" | "alt">,
  accelerators: Record<string, string> = defaultShortcutMap(),
  platform: NodeJS.Platform = process.platform,
): TabAction | "settings" | undefined {
  if (input.type !== "keyDown") return;
  for (const [id, action] of Object.entries(tabActions)) {
    if (matchesAccelerator(input, accelerators[id] ?? "", platform)) return action;
  }
  // Keep bracket aliases for tab cycling when focus is in a browser view.
  if (!input.alt && input.shift && (input.meta || input.control)) {
    if (input.key === "[") return "previous";
    if (input.key === "]") return "next";
  }
}
