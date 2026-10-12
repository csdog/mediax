import type { Input } from "electron";
import type { TabAction } from "../../shared/models";
export function tabShortcut(
  input: Pick<Input, "type" | "key" | "control" | "meta" | "shift" | "alt">,
): TabAction | "settings" | undefined {
  if (input.type !== "keyDown" || input.alt) return;
  const key = input.key.toLowerCase();
  if (input.control && key === "tab") return input.shift ? "previous" : "next";
  if (!input.control && !input.meta) return;
  if (key === "w" && !input.shift) return "close";
  if (key === "t") return input.shift ? "reopen" : "new";
  if (key === "," && !input.shift) return "settings";
  if (input.shift && key === "[") return "previous";
  if (input.shift && key === "]") return "next";
}
