import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShortcutSettings } from "@/hooks/useShortcutSettings";
import {
  acceleratorFromKeyboardEvent,
  defaultShortcutMap,
  formatAccelerator,
  normalizeAccelerator,
  shortcutCatalog,
} from "../../shared/shortcutCatalog";

export function ShortcutSettingsPanel() {
  const {
    shortcuts,
    shortcutMessage,
    setShortcutMessage,
    shortcutBusy,
    saveAccelerator,
    resetAll,
  } = useShortcutSettings();
  const [query, setQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const defaults = useMemo(() => defaultShortcutMap(), []);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shortcutCatalog;
    return shortcutCatalog.filter((item) => {
      const current = shortcuts[item.id] ?? "";
      return `${item.title} ${item.description} ${item.accelerator} ${current}`
        .toLowerCase()
        .includes(needle);
    });
  }, [query, shortcuts]);
  const allDefault = shortcutCatalog.every((item) =>
    sameAccelerator(shortcuts[item.id] ?? "", defaults[item.id] ?? ""),
  );
  return (
    <div className="shortcut-settings">
      <div className="shortcut-settings-header">
        <div className="shortcut-settings-search">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索快捷键"
            aria-label="搜索快捷键"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={shortcutBusy || allDefault}
          onClick={() => {
            setRecordingId(null);
            setShortcutMessage("");
            void resetAll();
          }}
        >
          全部重置为默认值
        </Button>
      </div>
      <div className="shortcut-settings-list" role="list">
        {items.map((item) => {
          const recording = recordingId === item.id;
          const current = shortcuts[item.id] ?? "";
          const display = formatAccelerator(current);
          const dirty = !sameAccelerator(current, defaults[item.id] ?? "");
          return (
            <div
              className="shortcut-settings-row"
              role="listitem"
              key={item.id}
              data-recording={recording || undefined}
            >
              <div className="shortcut-settings-copy">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <div className="shortcut-settings-keys">
                {recording ? (
                  <kbd className="shortcut-pill shortcut-pill-recording" aria-live="polite">
                    按下快捷键…
                  </kbd>
                ) : display ? (
                  <kbd className="shortcut-pill">{display}</kbd>
                ) : (
                  <kbd className="shortcut-pill">未设置</kbd>
                )}
              </div>
              <div className="shortcut-settings-actions">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={shortcutBusy}
                        aria-label={`编辑“${item.title}”的快捷键`}
                        aria-pressed={recording}
                        onClick={() => {
                          setShortcutMessage("");
                          setRecordingId(recording ? null : item.id);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>编辑“{item.title}”的快捷键</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={shortcutBusy || (!current && !recording)}
                        aria-label={`清除“${item.title}”的快捷键`}
                        onClick={() => {
                          setRecordingId(null);
                          setShortcutMessage("");
                          void saveAccelerator(item.id, "");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>清除“{item.title}”的快捷键</TooltipContent>
                </Tooltip>
                {dirty ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={shortcutBusy}
                          aria-label={`重置“${item.title}”的快捷键`}
                          onClick={() => {
                            setRecordingId(null);
                            setShortcutMessage("");
                            void saveAccelerator(item.id, defaults[item.id] ?? "");
                          }}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent>重置“{item.title}”的快捷键</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {recording ? (
                <input
                  className="shortcut-capture"
                  autoFocus
                  aria-label={`为“${item.title}”录制快捷键`}
                  onBlur={() => setRecordingId(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey)
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      setRecordingId(null);
                      return;
                    }
                    const next = acceleratorFromKeyboardEvent(event.nativeEvent);
                    if (typeof next === "object") {
                      setShortcutMessage(next.error);
                      return;
                    }
                    setShortcutMessage("");
                    setRecordingId(null);
                    void saveAccelerator(item.id, next);
                  }}
                />
              ) : null}
            </div>
          );
        })}
        {!items.length ? <p className="settings-no-results">没有匹配的快捷键</p> : null}
      </div>
      {shortcutMessage ? (
        <p className="settings-section-note" role="status">
          {shortcutMessage}
        </p>
      ) : null}
      <p className="settings-section-note">
        可自定义全部快捷键；清除后对应操作将不再响应按键。工作区标签页关闭后不会退出应用。
      </p>
    </div>
  );
}

function sameAccelerator(left: string, right: string) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return normalizeAccelerator(left) === normalizeAccelerator(right);
}
