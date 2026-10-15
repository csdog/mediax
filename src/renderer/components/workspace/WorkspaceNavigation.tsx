import { useState } from "react";
import { Download, Settings, ChevronDown, LoaderCircle, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ProfileMark } from "@/components/ProfileMark";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { CodexComposeIcon } from "./CodexNavigationIcons";
import { PublishKindDialog } from "./PublishKindDialog";
import { navigation as nav } from "@/app/navigation";
import { useWorkspace } from "@/app/WorkspaceContext";
import type { UpdateStatus } from "../../../shared/models";

function updatePromptLabel(status: UpdateStatus) {
  if (status.canInstall && status.availableVersion) {
    return `更新到 v${status.availableVersion}`;
  }
  if (status.state === "downloading") {
    return `正在下载更新${status.progress != null ? ` ${status.progress}%` : ""}`;
  }
  if (status.availableVersion) return `正在准备 v${status.availableVersion}`;
  return "有可用更新";
}

export function WorkspaceNavigation() {
  const {
    page,
    setPage,
    openPublish,
    setActiveBrowser,
    run,
    reload,
    avatarMenuOpen,
    setAvatarMenuOpen,
    setSidebarOpen,
    openSettings,
  } = useWorkspace();
  const { profile } = useProfileSettings();
  const { status: updateStatus, busy: updateBusy, installUpdate } = useAppUpdate();
  const [publishKindOpen, setPublishKindOpen] = useState(false);
  const showUpdatePrompt =
    updateStatus.availableVersion != null &&
    (updateStatus.state === "available" ||
      updateStatus.state === "downloading" ||
      updateStatus.state === "downloaded");
  const onUpdatePrompt = () => {
    if (!updateStatus.canInstall) return;
    void installUpdate();
  };
  return (
    <>
      <PublishKindDialog
        open={publishKindOpen}
        onOpenChange={setPublishKindOpen}
        onSelect={(kind) => {
          openPublish(kind);
          void run(reload);
        }}
      />
      <aside className="activity-rail" aria-label="快捷导航">
        <div className="flex flex-col gap-2">
          {nav.map((n) => {
            const Icon = page === n.id ? n.selectedIcon : n.icon;
            return (
              <Tooltip key={n.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={`打开${n.title}`}
                      data-active={page === n.id}
                      onClick={() => {
                        setActiveBrowser(null);
                        setPage(n.id);
                        void run(reload);
                      }}
                    >
                      <Icon
                        className="size-5 text-neutral-500 data-[active=true]:text-foreground"
                        data-active={page === n.id}
                      />
                    </Button>
                  }
                />
                <TooltipContent side="right">{n.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col items-center gap-2">
          {showUpdatePrompt ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full p-0"
                    data-update-prompt=""
                    aria-label={updatePromptLabel(updateStatus)}
                    disabled={updateBusy || !updateStatus.canInstall}
                    onClick={onUpdatePrompt}
                  >
                    {updateStatus.state === "downloading" ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <Download className="size-3" />
                    )}
                  </Button>
                }
              />
              <TooltipContent side="right">{updatePromptLabel(updateStatus)}</TooltipContent>
            </Tooltip>
          ) : null}
          <Popover
            open={avatarMenuOpen}
            onOpenChange={(open) => {
              if (open) setSidebarOpen(true);
              setAvatarMenuOpen(open);
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  className="rounded-full"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="打开头像菜单"
                >
                  <ProfileMark
                    name={profile.name}
                    avatar={profile.avatar}
                    size="sm"
                    className="size-6"
                  />
                </Button>
              }
            />
            <PopoverContent
              data-avatar-menu
              side="top"
              align="start"
              sideOffset={8}
              className="w-52 p-1.5"
              aria-label="用户菜单"
            >
              <div className="mb-1 flex items-center gap-2.5 border-b px-2.5 py-2.5">
                <ProfileMark name={profile.name} avatar={profile.avatar} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">本地工作空间</p>
                </div>
              </div>
              {showUpdatePrompt ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2.5 font-normal"
                  disabled={updateBusy || !updateStatus.canInstall}
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    onUpdatePrompt();
                  }}
                >
                  {updateStatus.state === "downloading" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {updateStatus.canInstall
                    ? `更新到 v${updateStatus.availableVersion}`
                    : updatePromptLabel(updateStatus)}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2.5 font-normal"
                onClick={() => {
                  setAvatarMenuOpen(false);
                  void openSettings();
                }}
              >
                <Settings className="size-4" />
                设置
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </aside>
      <Sidebar className="border-0" variant="sidebar">
        <SidebarHeader className="px-2 py-2">
          <div className="flex h-8 items-center gap-1.5 px-2">
            <span className="text-sm font-semibold">MediaX</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            className="justify-start px-2 font-normal"
            onClick={() => setPublishKindOpen(true)}
          >
            <CodexComposeIcon className="size-4" />
            发布
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="px-3 text-xs font-normal">项目</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => {
                  const Icon = page === n.id ? n.selectedIcon : n.icon;
                  return (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        className="font-normal"
                        isActive={page === n.id}
                        tooltip={n.title}
                        size={"lg"}
                        onClick={() => {
                          setActiveBrowser(null);
                          setPage(n.id);
                          void run(reload);
                        }}
                      >
                        <Icon />
                        <span>{n.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-2 px-2 pt-3 text-xs text-muted-foreground">
            <Monitor className="size-4" />
            本地工作空间
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
