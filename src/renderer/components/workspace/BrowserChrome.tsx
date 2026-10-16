import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, RotateCw, X } from "lucide-react";
import {
  CodexArrowLeftIcon,
  CodexArrowUpRightIcon,
  CodexDownloadIcon,
  CodexEllipsisHorizontalIcon,
  CodexPuzzleIcon,
} from "./CodexNavigationIcons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/app/WorkspaceContext";
import type {
  NativePopupAction,
  NativePopupKind,
  NativePopupRequest,
} from "../../../shared/models";

import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";

type ChromePopup = NativePopupKind | null;

function popupTheme(): NativePopupRequest["theme"] {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function BrowserChrome() {
  const queryClient = useQueryClient();
  const {
    activeBrowserViewId,
    submitOmnibox,
    openBrowser,
    goBackBrowser,
    goForwardBrowser,
    reloadBrowser,
    run,
    setSettingsOpen,
  } = useWorkspace();
  useEffect(
    () => () => {
      void window.desktop.hideNativePopup();
    },
    [],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const selectAddressOnMouseUp = useRef(false);
  const restoringOmniboxFocus = useRef(false);
  const omniboxRef = useRef<HTMLFormElement>(null);
  const extensionsAnchorRef = useRef<HTMLDivElement>(null);
  const downloadsAnchorRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const [popup, setPopup] = useState<ChromePopup>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
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
  const accounts = useQuery({
    queryKey: ["desktop", "accounts"],
    queryFn: () => window.desktop.accounts(),
    staleTime: 30_000,
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

  const [address, setAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const navigation = useBrowserNavigation(activeBrowserViewId, () => setSubmittingAddress(false));
  const currentUrl = navigation.data?.url ?? "";
  const [historyQuery, setHistoryQuery] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyOpen = popup === "history";
  const history = useQuery({
    queryKey: ["desktop", "browser-history", historyQuery ?? ""],
    enabled: historyOpen,
    queryFn: () => window.desktop.browserHistory(historyQuery ?? ""),
  });
  const suggestions = history.data ?? [];
  const hasSearchSuggestion = Boolean(historyQuery?.trim());
  const suggestionCount = suggestions.length + (hasSearchSuggestion ? 1 : 0);
  const pageReady = Boolean(activeBrowserViewId);
  const downloadItems = downloads.data ?? [];
  useEffect(() => {
    if (editingAddress || submittingAddress) return;
    setAddress(activeBrowserViewId ? currentUrl : "");
  }, [activeBrowserViewId, currentUrl, editingAddress, submittingAddress]);
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
  const externalLabel = "在外部浏览器中打开";
  const externalTarget = (editingAddress ? address : currentUrl).trim();
  const goToAddress = (value: string) => {
    setAddress(value);
    setSubmittingAddress(true);
    setEditingAddress(false);
    setPopup(null);
    setHistoryIndex(-1);
    void run(async () => {
      try {
        await submitOmnibox(value);
      } finally {
        setSubmittingAddress(false);
      }
    });
  };
  const openHistory = (url: string) => {
    const entry = suggestions.find((item) => item.url === url);
    const account = accounts.data?.find((item) => item.id === entry?.accountId);
    if (!account) {
      goToAddress(url);
      return;
    }
    setEditingAddress(false);
    setPopup(null);
    setHistoryIndex(-1);
    void run(() => openBrowser(account, url));
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
  const onPopupAction = (action: NativePopupAction) => {
    if (action.type === "open-downloads-folder") {
      void run(() => window.desktop.openDownloadsFolder());
      return;
    }
    if (action.type === "reveal-download") {
      void run(() => window.desktop.revealDownload(action.id));
      return;
    }
    if (action.type === "copy-download-url") {
      void run(() => window.desktop.copyDownloadUrl(action.id));
      return;
    }
    if (action.type === "copy-download-path") {
      void run(() => window.desktop.copyDownloadPath(action.id));
      return;
    }
    if (action.type === "remove-download") {
      void run(() => window.desktop.removeDownload(action.id));
      return;
    }
    if (action.type === "find") {
      setPopup(null);
      setFindOpen(true);
      return;
    }
    if (action.type === "print") {
      setPopup(null);
      if (!activeBrowserViewId) return;
      void run(() => window.desktop.printBrowser(activeBrowserViewId));
      return;
    }
    if (action.type === "zoom") {
      void run(() => changeZoom((zoom.data?.factor ?? 1) + action.delta));
      return;
    }
    if (action.type === "zoom-reset") {
      void run(() => changeZoom(1));
      return;
    }
    if (action.type === "screenshot") {
      setPopup(null);
      if (!activeBrowserViewId) return;
      void run(async () => {
        const path = await window.desktop.screenshotBrowser(activeBrowserViewId);
        if (path) toast.success(`截图已保存：${path}`);
        else toast.error("截图失败");
      });
      return;
    }
    if (action.type === "clear-data") {
      setPopup(null);
      if (!activeBrowserViewId) return;
      void run(async () => {
        await window.desktop.clearBrowserData(activeBrowserViewId);
        toast.success("已清除当前标签页的浏览数据");
      });
      return;
    }
    if (action.type === "show-downloads") {
      setPopup("downloads");
      return;
    }
    if (action.type === "settings") {
      setPopup(null);
      setSettingsOpen(true);
      return;
    }
    if (action.type === "open-history") openHistory(action.url);
    if (action.type === "submit-omnibox") goToAddress(action.value);
    if (action.type === "remove-history") {
      void run(async () => {
        await window.desktop.removeBrowserHistory(action.url);
        await queryClient.invalidateQueries({ queryKey: ["desktop", "browser-history"] });
        setHistoryIndex(-1);
      });
    }
  };
  useEffect(() => {
    return window.desktop.onNativePopupHostEvent((event) => {
      if (event.type === "focus-omnibox") {
        restoringOmniboxFocus.current = true;
        try {
          inputRef.current?.focus({ preventScroll: true });
        } finally {
          restoringOmniboxFocus.current = false;
        }
        return;
      }
      if (event.type === "closed") {
        inputRef.current?.blur();
        setEditingAddress(false);
        setHistoryIndex(-1);
        setPopup(null);
        return;
      }
      onPopupAction(event.action);
    });
  });
  useEffect(() => {
    if (!popup) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.querySelector("[data-browser-chrome]")?.contains(target)) return;
      setPopup(null);
      setEditingAddress(false);
      setHistoryIndex(-1);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [popup]);
  useEffect(() => {
    if (popup === "history" && !history.isFetched) return;
    if (popup === "history" && suggestionCount === 0) {
      void window.desktop.hideNativePopup();
      return;
    }
    if (!popup) {
      void window.desktop.hideNativePopup();
      return;
    }
    const theme = popupTheme();
    if (popup === "history") {
      const rect = omniboxRef.current?.getBoundingClientRect();
      if (!rect) return;
      const searchQuery =
        historyQuery !== null && historyQuery.trim() ? historyQuery.trim() : undefined;
      const historyEntries = suggestions.map((entry) => {
        if (entry.accountAvatar) return entry;
        const account = accounts.data?.find((item) => item.id === entry.accountId);
        if (!account?.avatar && !account?.name) return entry;
        return {
          ...entry,
          accountLabel: entry.accountLabel ?? account?.name,
          accountAvatar: account?.avatar ?? entry.accountAvatar,
        };
      });
      void window.desktop.showNativePopup({
        kind: "history",
        theme,
        x: Math.max(8, Math.round(rect.x)),
        y: Math.round(rect.bottom + 8),
        width: Math.max(160, Math.round(rect.width)),
        historyEntries,
        historyIndex,
        historySearchQuery: searchQuery,
      });
      return;
    }
    const anchor =
      popup === "downloads"
        ? downloadsAnchorRef.current
        : popup === "extensions"
          ? extensionsAnchorRef.current
          : menuAnchorRef.current;
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return;
    const width = popup === "downloads" ? 320 : popup === "extensions" ? 288 : 256;
    void window.desktop.showNativePopup({
      kind: popup,
      theme,
      x: Math.max(8, Math.round(rect.right - width)),
      y: Math.round(rect.bottom + 8),
      width,
      downloads: popup === "downloads" ? downloadItems.slice(0, 50) : undefined,
      pageReady,
      zoomPercent: zoom.data?.percent ?? 100,
    });
  }, [
    popup,
    history.data,
    history.isFetched,
    historyQuery,
    historyIndex,
    suggestionCount,
    accounts.data,
    downloads.data,
    pageReady,
    zoom.data?.percent,
  ]);
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
    <div className="browser-chrome-stack" data-browser-chrome>
      <div className="browser-chrome">
        <div className="toolbar-navigation" role="group" aria-label="导航">
          <Tooltip>
            <TooltipTrigger
              delay={400}
              render={
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
              }
            />
            <TooltipContent side="bottom">后退</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              delay={400}
              render={
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
              }
            />
            <TooltipContent side="bottom">前进</TooltipContent>
          </Tooltip>
          <span className="toolbar-nav-divider" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger
              delay={400}
              render={
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
              }
            />
            <TooltipContent side="bottom">刷新</TooltipContent>
          </Tooltip>
        </div>
        <form
          ref={omniboxRef}
          className={editingAddress ? "toolbar-omnibox is-editing" : "toolbar-omnibox"}
          onSubmit={onSubmitAddress}
        >
          {editingAddress && !address.trim() ? (
            <span className="toolbar-omnibox-ghost-hint" aria-hidden>
              {hint}
            </span>
          ) : null}
          <input
            ref={inputRef}
            name="url"
            aria-label={hint}
            placeholder={editingAddress ? "" : hint}
            value={address}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            role="combobox"
            aria-expanded={historyOpen && suggestionCount > 0}
            aria-controls="browser-history"
            aria-autocomplete="list"
            onMouseDown={(event) => {
              selectAddressOnMouseUp.current =
                !editingAddress || document.activeElement !== event.currentTarget;
            }}
            onMouseUp={(event) => {
              if (!selectAddressOnMouseUp.current) return;
              selectAddressOnMouseUp.current = false;
              event.currentTarget.select();
            }}
            onFocus={(event) => {
              // Only a native suggestion's temporary focus transfer preserves selection.
              if (restoringOmniboxFocus.current) return;
              setEditingAddress(true);
              setPopup("history");
              setHistoryQuery(null);
              setHistoryIndex(-1);
              event.currentTarget.select();
            }}
            onBlur={(event) => {
              // Native popup focus has no DOM relatedTarget. Its host owns dismissal.
              if (!event.relatedTarget) return;
              setEditingAddress(false);
              setPopup((current) => (current === "history" ? null : current));
              setHistoryIndex(-1);
            }}
            onChange={(event) => {
              setEditingAddress(true);
              setPopup("history");
              setHistoryQuery(event.target.value);
              setHistoryIndex(-1);
              setAddress(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestionCount) {
                event.preventDefault();
                setPopup("history");
                const index =
                  event.key === "ArrowDown"
                    ? Math.min(suggestionCount - 1, historyIndex + 1)
                    : Math.max(-1, historyIndex - 1);
                setHistoryIndex(index);
                setAddress(
                  index >= 0 && index < suggestions.length
                    ? suggestions[index]!.url
                    : (historyQuery ?? currentUrl),
                );
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setPopup(null);
                setHistoryIndex(-1);
                setHistoryQuery(null);
                setAddress(currentUrl);
                return;
              }
              if (event.key !== "Enter") return;
              event.preventDefault();
              const picked = historyIndex >= 0 ? suggestions[historyIndex] : undefined;
              if (historyOpen && picked) openHistory(picked.url);
              else goToAddress(event.currentTarget.value);
            }}
          />
          <Tooltip>
            <TooltipTrigger
              delay={400}
              render={
                <button
                  type="button"
                  className="toolbar-omnibox-external"
                  aria-label={externalLabel}
                  disabled={!externalTarget}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={() => {
                    const raw = (
                      editingAddress ? (inputRef.current?.value ?? address) : currentUrl
                    ).trim();
                    if (!raw) return;
                    void run(async () => {
                      const url = /^https?:\/\//i.test(raw)
                        ? raw
                        : await window.desktop.resolveOmniboxUrl(raw);
                      if (!url) throw new Error("无法在外部浏览器中打开");
                      await window.desktop.openExternalUrl(url);
                    });
                  }}
                >
                  <CodexArrowUpRightIcon className="size-4" />
                </button>
              }
            />
            <TooltipContent>{externalLabel}</TooltipContent>
          </Tooltip>
        </form>
        <div className="browser-chrome-actions">
          <div ref={extensionsAnchorRef} className="inline-flex">
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="toolbar-outline-plain"
                    aria-label="扩展"
                    onClick={() =>
                      setPopup((current) => (current === "extensions" ? null : "extensions"))
                    }
                  >
                    <CodexPuzzleIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>扩展</TooltipContent>
            </Tooltip>
          </div>
          <div ref={downloadsAnchorRef} className="inline-flex">
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="toolbar-outline-plain"
                    aria-label="下载"
                    onClick={() =>
                      setPopup((current) => (current === "downloads" ? null : "downloads"))
                    }
                  >
                    <CodexDownloadIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>下载</TooltipContent>
            </Tooltip>
          </div>
          <div ref={menuAnchorRef} className="inline-flex">
            <Tooltip>
              <TooltipTrigger
                delay={400}
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="toolbar-outline-plain"
                    aria-label="浏览器选项"
                    onClick={() =>
                      setPopup((current) => (current === "browser-menu" ? null : "browser-menu"))
                    }
                  >
                    <CodexEllipsisHorizontalIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>浏览器选项</TooltipContent>
            </Tooltip>
          </div>
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
