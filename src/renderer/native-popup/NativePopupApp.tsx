import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import {
  ChevronRight,
  EllipsisVertical,
  FileText,
  FolderOpen,
  Globe,
  Minus,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BrowserDownload,
  BrowserHistoryEntry,
  NativePopupAction,
  NativePopupRequest,
} from "../../shared/models";

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

// Share the same hover state across history rows, downloads, and menu items.
const rowHover: HTMLAttributes<HTMLElement> = {
  onMouseEnter: (event) => {
    event.currentTarget.dataset.hover = "true";
  },
  onMouseLeave: (event) => {
    delete event.currentTarget.dataset.hover;
  },
};

function HistoryIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Globe className="browser-history-fallback" aria-hidden />;
  return <img className="browser-history-icon" src={src} alt="" onError={() => setFailed(true)} />;
}

function formatHistoryUrl(url: string) {
  try {
    const page = new URL(url);
    const path = page.pathname !== "/" ? page.pathname.replace(/\/$/, "") : "";
    return `${page.hostname}${path}`;
  } catch {
    return url;
  }
}

function AccountAvatar({ entry }: { entry: BrowserHistoryEntry }) {
  const label = entry.accountLabel?.trim();
  const initial = label ? [...label][0]?.toUpperCase() : "";
  if (entry.accountAvatar) {
    return (
      <img
        className="browser-history-account-avatar"
        src={entry.accountAvatar}
        alt={label ? `${label} 头像` : ""}
      />
    );
  }
  if (!initial) return null;
  return (
    <span className="browser-history-account-avatar fallback" aria-hidden>
      {initial}
    </span>
  );
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
              <li key={item.id} className="browser-download-item" {...rowHover}>
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
                      {...rowHover}
                      onClick={() => act({ type: "reveal-download", id: item.id })}
                    >
                      {label}
                    </button>
                    <button
                      type="button"
                      {...rowHover}
                      onClick={() => act({ type: "copy-download-url", id: item.id })}
                    >
                      复制地址
                    </button>
                    <button
                      type="button"
                      {...rowHover}
                      onClick={() => act({ type: "copy-download-path", id: item.id })}
                    >
                      复制路径
                    </button>
                    <button
                      type="button"
                      {...rowHover}
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
  const searchQuery = popup.historySearchQuery?.trim();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div
      ref={listRef}
      className="browser-history select-none"
      role="listbox"
      aria-label="历史记录"
      onMouseDownCapture={(event) => {
        // Keep DOM focus out of suggestion buttons; activate only on click release.
        if (event.button === 0) event.preventDefault();
      }}
      onPointerDownCapture={() => window.getSelection()?.removeAllRanges()}
    >
      {entries.map((entry, index) => (
        <div
          key={entry.url}
          role="option"
          aria-selected={index === selected}
          className="browser-history-item"
          data-history-row={entry.url}
          {...rowHover}
          data-active={index === selected ? "true" : undefined}
        >
          <button
            type="button"
            className="browser-history-main"
            tabIndex={-1}
            onClick={() => act({ type: "open-history", url: entry.url })}
          >
            <HistoryIcon key={entry.icon} src={entry.icon} />
            <span className="browser-history-line">
              <span className="browser-history-title">{entry.title}</span>
              <span className="browser-history-sep" aria-hidden>
                —
              </span>
              <span className="browser-history-url">{formatHistoryUrl(entry.url)}</span>
            </span>
            <AccountAvatar entry={entry} />
          </button>
          <button
            type="button"
            className="browser-history-remove"
            aria-label="从历史记录中删除"
            tabIndex={-1}
            onClick={() => act({ type: "remove-history", url: entry.url })}
          >
            <X aria-hidden />
          </button>
        </div>
      ))}
      {searchQuery ? (
        <button
          type="button"
          className="browser-history-item browser-history-search"
          data-history-row="search"
          role="option"
          aria-selected={selected === entries.length}
          data-active={selected === entries.length ? "true" : undefined}
          {...rowHover}
          tabIndex={-1}
          onClick={() => act({ type: "submit-omnibox", value: searchQuery })}
        >
          <Search className="browser-history-search-icon" aria-hidden />
          <span className="browser-history-line">{searchQuery}</span>
        </button>
      ) : null}
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
    <button
      type="button"
      className="native-popup-row"
      disabled={disabled}
      {...rowHover}
      onClick={onClick}
    >
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
    const unsubscribe = window.desktop.onNativePopup((next) => {
      document.documentElement.classList.toggle("dark", next.theme === "dark");
      document.documentElement.classList.toggle("native-popup-history", next.kind === "history");
      setPopup(next);
    });
    window.desktop.notifyNativePopup({ type: "ready" });
    return unsubscribe;
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
