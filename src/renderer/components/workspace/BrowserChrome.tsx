import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  EllipsisVertical,
  FileText,
  FolderOpen,
  Minus,
  Plus,
  Puzzle,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import { CodexArrowLeftIcon } from "./CodexNavigationIcons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/app/WorkspaceContext";
import type { BrowserDownload } from "../../../shared/models";

function revealInFolderLabel() {
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

function canRevealDownload(item: BrowserDownload) {
  return item.state === "completed";
}

export function BrowserChrome() {
  const queryClient = useQueryClient();
  const {
    activeBrowserViewId,
    isNewTab,
    submitOmnibox,
    goBackBrowser,
    goForwardBrowser,
    reloadBrowser,
    run,
    setSettingsOpen,
  } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const navigation = useQuery({
    queryKey: ["desktop", "browser-navigation", activeBrowserViewId],
    enabled: Boolean(activeBrowserViewId),
    queryFn: () => window.desktop.browserNavigation(activeBrowserViewId!),
    refetchInterval: activeBrowserViewId ? 1000 : false,
  });
  const zoom = useQuery({
    queryKey: ["desktop", "browser-zoom", activeBrowserViewId],
    enabled: Boolean(activeBrowserViewId),
    queryFn: () => window.desktop.browserZoom(activeBrowserViewId!),
  });
  const provider = useQuery({
    queryKey: ["desktop", "web-search-provider"],
    queryFn: () => window.desktop.webSearchProvider(),
    staleTime: 60_000,
  });
  const downloads = useQuery({
    queryKey: ["desktop", "downloads"],
    queryFn: () => window.desktop.downloads(),
  });
  useEffect(() => {
    const stop = window.desktop.onDownloadsChanged((items) => {
      queryClient.setQueryData(["desktop", "downloads"], items);
    });
    return stop;
  }, [queryClient]);
  const searchName = provider.data?.name?.trim();
  const hint = searchName ? `搜索 ${searchName} 或输入网址` : "搜索或输入网址";
  const currentUrl = navigation.data?.url ?? "";
  const [address, setAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const pageReady = Boolean(activeBrowserViewId);
  const downloadItems = downloads.data ?? [];
  const revealLabel = revealInFolderLabel();
  useEffect(() => {
    if (editingAddress) return;
    setAddress(activeBrowserViewId ? currentUrl : "");
  }, [activeBrowserViewId, currentUrl, editingAddress]);
  useEffect(() => {
    if (!isNewTab) return;
    inputRef.current?.focus();
  }, [isNewTab]);
  useEffect(() => {
    if (!findOpen) return;
    findRef.current?.focus();
    findRef.current?.select();
  }, [findOpen]);
  useEffect(() => {
    if (activeBrowserViewId) return;
    setFindOpen(false);
    setFindQuery("");
  }, [activeBrowserViewId]);
  const goToAddress = (value: string) => {
    setEditingAddress(false);
    void run(() => submitOmnibox(value));
  };
  const onSubmitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("url");
    goToAddress(input instanceof HTMLInputElement ? input.value : address);
  };
  const refreshZoom = async () => {
    if (!activeBrowserViewId) return;
    await queryClient.invalidateQueries({
      queryKey: ["desktop", "browser-zoom", activeBrowserViewId],
    });
  };
  const changeZoom = async (next: number) => {
    if (!activeBrowserViewId) return;
    await window.desktop.setBrowserZoom(activeBrowserViewId, next);
    await refreshZoom();
  };
  const keepMenuOpen = (event: Event | MouseEvent) => {
    event.preventDefault();
  };
  const runFind = (forward = true, findNext = true) => {
    if (!activeBrowserViewId) return;
    void run(() =>
      window.desktop.findInBrowser(activeBrowserViewId, findQuery, { forward, findNext }),
    );
  };
  const closeFind = () => {
    setFindOpen(false);
    setFindQuery("");
    if (activeBrowserViewId) void window.desktop.stopFindInBrowser(activeBrowserViewId);
  };
  return (
    <div className="browser-chrome-stack">
      <div className="browser-chrome">
        <div className="toolbar-navigation">
          <Button
            variant="ghost"
            size="icon"
            className="toolbar-nav-button"
            aria-label="后退"
            disabled={!navigation.data?.canGoBack}
            onClick={() => void run(() => goBackBrowser())}
          >
            <CodexArrowLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="toolbar-nav-button"
            aria-label="前进"
            disabled={!navigation.data?.canGoForward}
            onClick={() => void run(() => goForwardBrowser())}
          >
            <CodexArrowLeftIcon className="size-4 -scale-x-100" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="toolbar-nav-button"
            aria-label="刷新"
            disabled={!pageReady}
            onClick={() => void run(() => reloadBrowser())}
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
        <form
          className={editingAddress ? "toolbar-omnibox is-editing" : "toolbar-omnibox"}
          onSubmit={onSubmitAddress}
        >
          <input
            ref={inputRef}
            name="url"
            aria-label={hint}
            placeholder={hint}
            value={address}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onFocus={() => setEditingAddress(true)}
            onBlur={() => setEditingAddress(false)}
            onChange={(event) => {
              setEditingAddress(true);
              setAddress(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              goToAddress(event.currentTarget.value);
            }}
          />
        </form>
        <div className="browser-chrome-actions">
          <Popover>
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="toolbar-nav-button"
                        aria-label="扩展"
                      >
                        <Puzzle />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>扩展</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={8} className="browser-chrome-panel w-72 p-0">
              <div className="browser-chrome-panel-header">
                <span>扩展</span>
              </div>
              <p className="browser-chrome-panel-empty">暂未支持浏览器扩展</p>
            </PopoverContent>
          </Popover>

          <Popover open={downloadsOpen} onOpenChange={setDownloadsOpen}>
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="toolbar-nav-button"
                        aria-label="下载"
                      >
                        <Download />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>下载</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={8} className="browser-chrome-panel w-80 p-0">
              <div className="browser-chrome-panel-header">
                <span>下载</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="打开下载文件夹"
                  onClick={() => void run(() => window.desktop.openDownloadsFolder())}
                >
                  <FolderOpen />
                </Button>
              </div>
              {downloadItems.length ? (
                <ul className="browser-download-list">
                  {downloadItems.map((item) => {
                    const revealable = canRevealDownload(item);
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
                            aria-label={revealLabel}
                            disabled={!revealable}
                            onClick={() => void run(() => window.desktop.revealDownload(item.id))}
                          >
                            <FolderOpen />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-xs" aria-label="下载项选项">
                                  <EllipsisVertical />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem
                                disabled={!revealable}
                                onClick={() =>
                                  void run(() => window.desktop.revealDownload(item.id))
                                }
                              >
                                {revealLabel}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  void run(() => window.desktop.copyDownloadUrl(item.id))
                                }
                              >
                                复制地址
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  void run(() => window.desktop.copyDownloadPath(item.id))
                                }
                              >
                                复制路径
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  void run(() => window.desktop.removeDownload(item.id))
                                }
                              >
                                从列表中移除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="browser-chrome-panel-empty">暂无下载内容</p>
              )}
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="toolbar-nav-button"
                        aria-label="浏览器选项"
                      >
                        <EllipsisVertical />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>浏览器选项</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="browser-options-menu min-w-64">
              <DropdownMenuItem
                disabled={!pageReady}
                onClick={() => {
                  setFindOpen(true);
                }}
              >
                在页面中查找
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!pageReady}
                onClick={() => {
                  if (!activeBrowserViewId) return;
                  void run(() => window.desktop.printBrowser(activeBrowserViewId));
                }}
              >
                打印
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div
                className="browser-zoom-row"
                onClick={keepMenuOpen}
                onPointerDown={keepMenuOpen}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <span>缩放</span>
                <div className="browser-zoom-controls">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="缩小"
                    disabled={!pageReady}
                    onClick={() => void run(() => changeZoom((zoom.data?.factor ?? 1) - 0.1))}
                  >
                    <Minus />
                  </Button>
                  <span className="browser-zoom-value">{zoom.data?.percent ?? 100}%</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="放大"
                    disabled={!pageReady}
                    onClick={() => void run(() => changeZoom((zoom.data?.factor ?? 1) + 0.1))}
                  >
                    <Plus />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="重置缩放"
                    disabled={!pageReady}
                    onClick={() => void run(() => changeZoom(1))}
                  >
                    <RotateCcw />
                  </Button>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="justify-between opacity-50">
                Device toolbar
                <ChevronRight className="size-4" />
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!pageReady}
                onClick={() => {
                  if (!activeBrowserViewId) return;
                  void run(async () => {
                    const path = await window.desktop.screenshotBrowser(activeBrowserViewId);
                    if (path) toast.success(`截图已保存：${path}`);
                    else toast.error("截图失败");
                  });
                }}
              >
                截取屏幕截图
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="opacity-50">
                导入 Cookie 和密码…
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="justify-between opacity-50">
                密码和自动填充
                <ChevronRight className="size-4" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDownloadsOpen(true)}>下载</DropdownMenuItem>
              <DropdownMenuItem disabled className="opacity-50" title="浏览历史将在后续版本提供">
                历史记录
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!pageReady}
                onClick={() => {
                  if (!activeBrowserViewId) return;
                  void run(async () => {
                    await window.desktop.clearBrowserData(activeBrowserViewId);
                    toast.success("已清除当前标签页的浏览数据");
                  });
                }}
              >
                清除浏览数据
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>浏览器设置</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {findOpen ? (
        <form
          className="browser-find-bar"
          onSubmit={(event) => {
            event.preventDefault();
            runFind(true, false);
          }}
        >
          <input
            ref={findRef}
            aria-label="在页面中查找"
            placeholder="在页面中查找"
            value={findQuery}
            onChange={(event) => setFindQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeFind();
              } else if (event.key === "Enter") {
                event.preventDefault();
                runFind(!event.shiftKey, true);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="上一个"
            disabled={!pageReady || !findQuery.trim()}
            onClick={() => runFind(false, true)}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="下一个"
            disabled={!pageReady || !findQuery.trim()}
            onClick={() => runFind(true, true)}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="关闭查找"
            onClick={closeFind}
          >
            <X />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
