import { useEffect } from "react";
import { useShortcutSettings } from "@/hooks/useShortcutSettings";
import { SettingsLayout } from "@/components/SettingsLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useWorkspace } from "@/app/WorkspaceContext";

export function SettingsPage() {
  const { setSettingsOpen } = useWorkspace();
  const { shortcut, setShortcut, shortcutMessage, setShortcutMessage, shortcutBusy, saveShortcut } =
    useShortcutSettings();
  useEffect(() => {
    document.getElementById("settings-page-title")?.focus();
    const back = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !shortcutBusy) {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [shortcutBusy]);
  return (
    <main className="settings-full-page" aria-label="设置页面">
      <SettingsLayout onBack={() => setSettingsOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!shortcutBusy) saveShortcut();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="global-shortcut">全局呼出快捷键</Label>
            <Input
              id="global-shortcut"
              readOnly
              disabled={shortcutBusy}
              value={shortcut
                .replace(/CommandOrControl|CmdOrCtrl/g, "⌘")
                .replace(/Command|Cmd/g, "⌘")
                .replace(/Control|Ctrl/g, "⌃")
                .replace(/Alt|Option/g, "⌥")
                .replace(/Shift/g, "⇧")
                .replace(/Space/g, "空格")}
              placeholder="点击后按下快捷键"
              onKeyDown={(event) => {
                if (event.key === "Tab") return;
                event.preventDefault();
                if (["Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key)) return;
                if (!event.metaKey && !event.ctrlKey && !event.altKey) {
                  setShortcutMessage("请同时按住 Command、Control 或 Option。");
                  return;
                }
                const key =
                  event.code === "Space"
                    ? "Space"
                    : /^Key[A-Z]$/.test(event.code)
                      ? event.code.slice(3)
                      : /^Digit[0-9]$/.test(event.code)
                        ? event.code.slice(5)
                        : event.key.replace(/^Arrow/, "");
                if (
                  !/^(?:[A-Za-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter|Up|Down|Left|Right)$/.test(
                    key,
                  )
                ) {
                  setShortcutMessage("暂不支持这个按键，请换一个组合。");
                  return;
                }
                setShortcut(
                  [
                    event.metaKey && "Command",
                    event.ctrlKey && "Control",
                    event.altKey && "Alt",
                    event.shiftKey && "Shift",
                    key,
                  ]
                    .filter(Boolean)
                    .join("+"),
                );
                setShortcutMessage("");
              }}
            />
            <p className="text-xs text-muted-foreground">
              点击输入框并按下组合键。应用运行时，即使窗口隐藏也能呼出。
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={shortcutBusy}
              onClick={() => {
                setShortcut("CommandOrControl+M");
                setShortcutMessage("");
              }}
            >
              恢复默认
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={shortcutBusy}
              onClick={() => {
                setShortcut("");
                setShortcutMessage("");
              }}
            >
              清除快捷键
            </Button>
          </div>
          {shortcutMessage && (
            <p role="status" className="text-sm text-muted-foreground">
              {shortcutMessage}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={shortcutBusy}>
              {shortcutBusy ? "正在保存…" : "保存设置"}
            </Button>
          </DialogFooter>
        </form>
      </SettingsLayout>
    </main>
  );
}
