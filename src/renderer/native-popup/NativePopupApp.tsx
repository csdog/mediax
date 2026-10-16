import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  EllipsisVertical,
  FileText,
  FolderOpen,
  Globe,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrowserDownload, NativePopupAction, NativePopupRequest } from "../../shared/models";

function revealLabel() {
  const platform = window.desktopPlatform;
  if (platform === "darwin") return "在访达中显示";
  if (platform === "win32") return "在资源管理器中显示";
  return "在文件夹中显示";
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function downloadStatusText(item: BrowserDownload) {
  const clock = formatClock(item.endedAt ?? item.startedAt);
  if (item.state === "progressing") {
    const received = formatBytes(item.receivedBytes);
    const total = formatBytes(item.totalBytes);
    if (received && total) return `下载中 · ${received} / ${total}`;
    if (received) return `下载中 · ${received}`;
    return "下载中";
  }
  if (item.state === "completed") return `已完成 · ${clock}`;
  return `已停止 · ${clock}`;
}

function act(action: NativePopupAction) {
  window.desktop.notifyNativePopup({ type: "action", action });
}

function HistoryIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Globe className="browser-history-fallback" aria-hidden />;
  return <img className="browser-history-icon" src={src} alt="" onError={() => setFailed(true)} />;
}

function DownloadPanel({ items }: { items: BrowserDownload[] }) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const label = revealLabel();
  return (
    <>
      <div className="browser-chrome-panel-header">
        <span>下载</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="打开下载文件夹"
          onClick={() => act({ type: "open-downloads-folder" })}
        >
          <FolderOpen />
        </Button>
      </div>
      {items.length ? (
        <ul className="browser-download-list">
          {items.map((item) => {
            const revealable = item.state === "completed";
            return (
              <li key={item.id} className="browser-download-item">
                <div className="browser-download-icon" aria-hidden>
                  <FileText />
                </div>
                <div className="browser-download-meta">
                  <p className="browser-download-name" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="browser-download-status">{downloadStatusText(item)}</p>
                </div>
                <div className="browser-download-actions">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={label}
                    disabled={!revealable}
                    onClick={() => act({ type: "reveal-download", id: item.id })}
                  >
                    <FolderOpen />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="下载项选项"
                    onClick={() => setMenuId((current) => (current === item.id ? null : item.id))}
                  >
                    <EllipsisVertical />
                  </Button>
                </div>
                {menuId === item.id ? (
                  <div className="native-popup-menu">
                    <button
                      type="button"
                      disabled={!revealable}
                      onClick={() => act({ type: "reveal-download", id: item.id })}
                    >
                      {label}
                    </button>
                    <button
                      type="button"
                      onClick={() => act({ type: "copy-download-url", id: item.id })}
                    >
                      复制地址
                    </button>
                    <button
                      type="button"
                      onClick={() => act({ type: "copy-download-path", id: item.id })}
                    >
                      复制路径
                    </button>
                    <button
                      type="button"
                      onClick={() => act({ type: "remove-download", id: item.id })}
                    >
                      从列表中移除
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="browser-chrome-panel-empty">暂无下载内容</p>
      )}
    </>
  );
}

function HistoryPanel({ popup }: { popup: NativePopupRequest }) {
  const entries = popup.historyEntries ?? [];
  const selected = popup.historyIndex ?? -1;
  return (
    <div className="browser-history" role="listbox" aria-label="历史记录">
      {entries.map((entry, index) => (
        <button
          key={entry.url}
          type="button"
          role="option"
          aria-selected={index === selected}
          className="browser-history-item"
          data-active={index === selected ? "true" : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            act({ type: "open-history", url: entry.url });
          }}
        >
          <HistoryIcon src={entry.icon} />
          <span className="browser-history-copy">
            <span className="browser-history-title">{entry.title}</span>
            <span className="browser-history-url">{entry.url}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MenuRow({
  disabled,
  children,
  onClick,
}: {
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="native-popup-row" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function BrowserMenu({ popup }: { popup: NativePopupRequest }) {
  const ready = popup.pageReady === true;
  return (
    <div className="browser-options-menu">
      <MenuRow disabled={!ready} onClick={() => act({ type: "find" })}>
        在页面中查找
      </MenuRow>
      <MenuRow disabled={!ready} onClick={() => act({ type: "print" })}>
        打印
      </MenuRow>
      <div className="browser-zoom-row">
        <span>缩放</span>
        <div className="browser-zoom-controls">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="缩小"
            disabled={!ready}
            onClick={() => act({ type: "zoom", delta: -0.1 })}
          >
            <Minus />
          </Button>
          <span className="browser-zoom-value">{popup.zoomPercent ?? 100}%</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="放大"
            disabled={!ready}
            onClick={() => act({ type: "zoom", delta: 0.1 })}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="重置缩放"
            disabled={!ready}
            onClick={() => act({ type: "zoom-reset" })}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <MenuRow disabled>
        Device toolbar
        <ChevronRight className="size-4" />
      </MenuRow>
      <MenuRow disabled={!ready} onClick={() => act({ type: "screenshot" })}>
        截取屏幕截图
      </MenuRow>
      <MenuRow disabled>导入 Cookie 和密码…</MenuRow>
      <MenuRow disabled>
        密码和自动填充
        <ChevronRight className="size-4" />
      </MenuRow>
      <MenuRow onClick={() => act({ type: "show-downloads" })}>下载</MenuRow>
      <MenuRow disabled>历史记录</MenuRow>
      <MenuRow disabled={!ready} onClick={() => act({ type: "clear-data" })}>
        清除浏览数据
      </MenuRow>
      <MenuRow onClick={() => act({ type: "settings" })}>浏览器设置</MenuRow>
    </div>
  );
}

export function NativePopupApp() {
  const [popup, setPopup] = useState<NativePopupRequest | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return window.desktop.onNativePopup((next) => {
      document.documentElement.classList.toggle("dark", next.theme === "dark");
      setPopup(next);
    });
  }, []);
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !popup) return;
    const report = () => {
      const height = Math.ceil(card.scrollHeight);
      if (height > 0) window.desktop.notifyNativePopup({ type: "resize", height });
    };
    const observer = new ResizeObserver(report);
    observer.observe(card);
    report();
    return () => observer.disconnect();
  }, [popup]);
  if (!popup) return <div ref={cardRef} className="native-popup-shell" aria-hidden />;
  return (
    <div ref={cardRef} className="native-popup-shell">
      <div className="native-popup-card">
        {popup.kind === "downloads" ? <DownloadPanel items={popup.downloads ?? []} /> : null}
        {popup.kind === "extensions" ? (
          <>
            <div className="browser-chrome-panel-header">
              <span>扩展</span>
            </div>
            <p className="browser-chrome-panel-empty">暂未支持浏览器扩展</p>
          </>
        ) : null}
        {popup.kind === "history" ? <HistoryPanel popup={popup} /> : null}
        {popup.kind === "browser-menu" ? <BrowserMenu popup={popup} /> : null}
      </div>
    </div>
  );
}
