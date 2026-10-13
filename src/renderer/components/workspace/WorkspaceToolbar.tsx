import { ArrowLeft, ArrowRight, FolderOpen, X, Monitor, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useWorkspace } from "@/app/WorkspaceContext";
import { useNativeTabPreview } from "@/hooks/useNativeTabPreview";

export function WorkspaceToolbar() {
  const {
    settingsOpen,
    setSettingsOpen,
    activeBrowser,
    setActiveBrowser,
    browserTabs,
    setHoveredTab,
    hoveredTab,
    pageTitle,
    page,
    accounts,
    records,
    body,
    tabPreview,
    run,
    closeBrowserTab,
    newBrowserTab,
  } = useWorkspace();
  const nativePreview = typeof window.desktop.showTabPreview === "function";
  useNativeTabPreview(nativePreview ? hoveredTab : null);
  return (
    <div className="app-toolbar window-drag">
      <div className="toolbar-navigation">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="后退"
          disabled={!settingsOpen}
          onClick={() => setSettingsOpen(false)}
        >
          <ArrowLeft />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="前进" disabled>
          <ArrowRight />
        </Button>
        <SidebarTrigger aria-label="切换侧栏" />
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
                  <span>{pageTitle}</span>
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
                <p className="text-sm font-medium">{pageTitle}</p>
                <p className="text-xs text-muted-foreground">MediaX · 本地工作空间</p>
              </div>
              <div className="border-t bg-background p-3 text-xs text-muted-foreground">
                {page === "accounts" ? (
                  `${accounts.length} 个账号 · ${accounts.filter((account) => account.login === "logged_in").length} 个已登录`
                ) : page === "history" ? (
                  `${records.tasks.length} 条发布记录`
                ) : (
                  <p className="line-clamp-5 whitespace-pre-wrap">
                    {body.trim() || "尚未编辑内容"}
                  </p>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
          {browserTabs.map((tab) => (
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
                      aria-selected={activeBrowser === tab.id}
                      onClick={() => {
                        setHoveredTab(null);
                        setActiveBrowser(tab.id);
                      }}
                    >
                      {tab.name}
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
                aria-label={`${tab.name} 页面预览`}
                data-preview-tab={tab.id}
              >
                <div className="space-y-1 px-3 py-2.5">
                  <p className="truncate text-sm font-medium">{tab.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tabPreview?.id === tab.id
                      ? tabPreview.data?.title || tabPreview.error || "Facebook"
                      : "正在获取预览…"}
                  </p>
                  {tabPreview?.id === tab.id && tabPreview.data?.hostname && (
                    <p className="text-xs text-muted-foreground">{tabPreview.data.hostname}</p>
                  )}
                </div>
                {tabPreview?.id === tab.id && tabPreview.data?.image ? (
                  <img
                    className="tab-preview-image"
                    src={tabPreview.data.image}
                    alt={`${tab.name} 页面缩略图`}
                  />
                ) : (
                  <div className="tab-preview-placeholder">
                    <Monitor className="size-6 text-muted-foreground" />
                  </div>
                )}
              </HoverCardContent>
            </HoverCard>
          ))}
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
