import {
  CodexSidebarIcon,
  CodexSidebarHiddenIcon,
  CodexArrowLeftIcon,
} from "./CodexNavigationIcons";
import { FolderOpen, Loader2, X, Monitor, Plus, Globe } from "lucide-react";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProfileMark } from "@/components/ProfileMark";
import { useWorkspace } from "@/app/WorkspaceContext";
import { desktopPages } from "@/app/navigation";
import { useNativeTabPreview } from "@/hooks/useNativeTabPreview";

export function WorkspaceToolbar() {
  const {
    settingsOpen,
    setSettingsOpen,
    activeBrowser,
    activeBrowserViewId,
    setActiveBrowser,
    browserTabs,
    setHoveredTab,
    hoveredTab,
    workspaceTitle,
    workspacePage,
    browserNavAction,
    accounts,
    records,
    body,
    tabPreview,
    run,
    closeBrowserTab,
    newBrowserTab,
    goBackBrowser,
    goForwardBrowser,
  } = useWorkspace();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const navigation = useBrowserNavigation(activeBrowserViewId);
  const canGoBack = settingsOpen || Boolean(navigation.data?.canGoBack);
  const canGoForward = !settingsOpen && Boolean(navigation.data?.canGoForward);
  const backLoading = browserNavAction === "back";
  const forwardLoading = browserNavAction === "forward";
  const nativePreview = typeof window.desktop.showTabPreview === "function";
  useNativeTabPreview(nativePreview ? hoveredTab : null);
  return (
    <div className="app-toolbar window-drag">
      <div className="toolbar-navigation window-no-drag">
        <Tooltip>
          <TooltipTrigger
            delay={400}
            render={
              <Button
                variant="ghost"
                size="icon"
                className="toolbar-nav-button"
                aria-label="后退"
                aria-busy={backLoading || undefined}
                disabled={!canGoBack}
                onClick={() => {
                  if (settingsOpen) {
                    setSettingsOpen(false);
                    return;
                  }
                  void run(() => goBackBrowser());
                }}
              >
                {backLoading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <CodexArrowLeftIcon className="size-5" />
                )}
              </Button>
            }
          />
          <TooltipContent>后退</TooltipContent>
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
                aria-busy={forwardLoading || undefined}
                disabled={!canGoForward}
                onClick={() => void run(() => goForwardBrowser())}
              >
                {forwardLoading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <CodexArrowLeftIcon className="size-5 -scale-x-100" />
                )}
              </Button>
            }
          />
          <TooltipContent>前进</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            delay={400}
            render={
              <Button
                variant="ghost"
                size="icon"
                className="toolbar-nav-button"
                aria-label="切换侧栏"
                data-slot="sidebar-trigger"
                onClick={toggleSidebar}
              >
                {sidebarState === "collapsed" ? (
                  <CodexSidebarHiddenIcon className="size-5" />
                ) : (
                  <CodexSidebarIcon className="size-5" />
                )}
              </Button>
            }
          />
          <TooltipContent>{sidebarState === "collapsed" ? "显示侧栏" : "隐藏侧栏"}</TooltipContent>
        </Tooltip>
      </div>
      <div className="tab-strip">
        <div
          className="browser-tabs window-no-drag"
          role="tablist"
          aria-label="工作区标签页"
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).getAttribute("role") !== "tab") return;
            const ids = [null, ...browserTabs.map((tab) => tab.id)];
            let index = ids.indexOf(activeBrowser);
            if (event.key === "ArrowRight") index = (index + 1) % ids.length;
            else if (event.key === "ArrowLeft") index = (index - 1 + ids.length) % ids.length;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = ids.length - 1;
            else return;
            event.preventDefault();
            setHoveredTab(null);
            setActiveBrowser(ids[index]);
            event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
          }}
        >
          <HoverCard
            open={hoveredTab === "workspace"}
            onOpenChange={(open) =>
              setHoveredTab((current) =>
                open ? "workspace" : current === "workspace" ? null : current,
              )
            }
          >
            <HoverCardTrigger
              delay={hoveredTab ? 0 : 400}
              closeDelay={100}
              render={
                <button
                  className="toolbar-tab"
                  role="tab"
                  aria-selected={!activeBrowser}
                  onClick={() => {
                    setHoveredTab(null);
                    setActiveBrowser(null);
                  }}
                >
                  <FolderOpen className="size-3.5" />
                  <span>{workspaceTitle}</span>
                </button>
              }
            />
            <HoverCardContent
              side="bottom"
              align="start"
              sideOffset={8}
              className={`w-72 overflow-hidden p-0${nativePreview ? " tab-preview-source" : ""}`}
              aria-label="工作区预览"
              data-preview-tab="workspace"
            >
              <div className="space-y-1 px-3 py-2.5">
                <p className="text-sm font-medium">{workspaceTitle}</p>
                <p className="text-xs text-muted-foreground">MediaX · 本地工作空间</p>
              </div>
              <div className="border-t bg-background p-3 text-xs text-muted-foreground">
                {workspacePage === "accounts" ? (
                  `${accounts.length} 个账号 · ${accounts.filter((account) => account.login === "logged_in").length} 个已登录`
                ) : workspacePage === "history" ? (
                  `${records.tasks.length} 条发布记录`
                ) : (
                  <p className="line-clamp-5 whitespace-pre-wrap">
                    {body.trim() || "尚未编辑内容"}
                  </p>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
          {browserTabs.map((tab) => {
            const account = accounts.find((account) => account.id === tab.id);
            const PageIcon =
              tab.kind === "page"
                ? desktopPages.find((item) => item.id === tab.page)?.icon
                : undefined;
            return (
              <HoverCard
                key={tab.id}
                open={hoveredTab === tab.id}
                onOpenChange={(open) =>
                  setHoveredTab((current) => (open ? tab.id : current === tab.id ? null : current))
                }
              >
                <HoverCardTrigger
                  delay={hoveredTab ? 0 : 400}
                  closeDelay={100}
                  render={
                    <div
                      className="browser-tab"
                      data-active={activeBrowser === tab.id}
                      onAuxClick={(event) => {
                        if (event.button === 1) {
                          event.preventDefault();
                          void run(() => closeBrowserTab(tab.id));
                        }
                      }}
                    >
                      <button
                        role="tab"
                        aria-label={tab.name}
                        className="inline-flex items-center gap-2"
                        aria-selected={activeBrowser === tab.id}
                        onClick={() => {
                          setHoveredTab(null);
                          setActiveBrowser(tab.id);
                        }}
                      >
                        {PageIcon ? (
                          <PageIcon className="size-4 shrink-0" aria-hidden />
                        ) : tab.kind !== "new" && tab.kind !== "compose" && tab.kind !== "page" ? (
                          tab.icon ? (
                            <img
                              src={tab.icon}
                              alt="网站图标"
                              className="size-4 shrink-0 object-contain"
                            />
                          ) : (
                            <Globe
                              aria-label="网站图标"
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                          )
                        ) : null}
                        <span className="min-w-0 truncate">{tab.name}</span>
                        {account ? (
                          <span
                            title={account.name}
                            aria-label={`账号：${account.name}`}
                            className="ml-1 inline-flex shrink-0"
                          >
                            <ProfileMark
                              name={account.name}
                              avatar={account.avatar ?? null}
                              size="sm"
                              className="size-4"
                            />
                          </span>
                        ) : null}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`关闭 ${tab.name} 标签页`}
                        onClick={() => void run(() => closeBrowserTab(tab.id))}
                      >
                        <X />
                      </Button>
                    </div>
                  }
                />
                <HoverCardContent
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  className={`w-72 overflow-hidden p-0${nativePreview ? " tab-preview-source" : ""}`}
                  aria-label={
                    tabPreview?.id === tab.id && tabPreview.data?.title
                      ? `${tabPreview.data.title} 页面预览`
                      : "页面预览"
                  }
                  data-preview-tab={tab.id}
                >
                  <div className="space-y-1 px-3 py-2.5">
                    <p className="truncate text-sm font-medium">
                      {tabPreview?.id === tab.id
                        ? tabPreview.data?.title ||
                          tabPreview.error ||
                          (tab.kind === "web" ||
                          tab.kind === "new" ||
                          tab.kind === "page" ||
                          tab.kind === "compose"
                            ? tab.name
                            : "页面预览")
                        : tab.kind === "new" || tab.kind === "page" || tab.kind === "compose"
                          ? tab.name
                          : "正在获取预览…"}
                    </p>
                    {tabPreview?.id === tab.id && tabPreview.data?.hostname ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {tabPreview.data.hostname}
                      </p>
                    ) : null}
                  </div>
                  {tabPreview?.id === tab.id && tabPreview.data?.image ? (
                    <img
                      className="tab-preview-image"
                      src={tabPreview.data.image}
                      alt={tabPreview.data.title ? `${tabPreview.data.title} 缩略图` : "页面缩略图"}
                    />
                  ) : (
                    <div className="tab-preview-placeholder">
                      <Monitor className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="new-tab-button"
          aria-label="新建标签页"
          title="新建标签页"
          onClick={newBrowserTab}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
