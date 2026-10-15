import { useState } from "react";
import { CircleHelp, Globe, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/app/WorkspaceContext";
import { platformIcons } from "@/assets/platformIcons";
import type { PlatformId } from "../../../shared/models";
import {
  platformGroups,
  platformInfo,
  platformsInGroup,
  type PlatformGroupId,
} from "../../../shared/platforms";

export function WorkspaceDialogs() {
  const {
    accountDialogOpen,
    setAccountDialogOpen,
    busy,
    run,
    accounts,
    reload,
    openBrowser,
    setNotice,
  } = useWorkspace();
  const [group, setGroup] = useState<PlatformGroupId>("all");
  const [query, setQuery] = useState("");
  const close = (open: boolean) => {
    setAccountDialogOpen(open);
    if (!open) {
      setGroup("all");
      setQuery("");
    }
  };
  const authorize = (id: PlatformId) => {
    if (busy) return;
    const label = platformInfo[id].label;
    void run(async () => {
      const account = await window.desktop.addAccount(
        `${label} 账号 ${accounts.filter((item) => item.platform === id).length + 1}`,
        id,
      );
      await reload();
      close(false);
      await openBrowser(account);
      setNotice("请在账号浏览器中完成登录，登录后会自动识别。");
    });
  };
  const keyword = query.trim().toLowerCase();
  const visible = platformsInGroup(group).filter((id) =>
    platformInfo[id].label.toLowerCase().includes(keyword),
  );
  const showOther = group === "all" && "其他账号".toLowerCase().includes(keyword);
  return (
    <Dialog open={accountDialogOpen} onOpenChange={close}>
      <DialogContent className="gap-4 p-6 sm:max-w-[880px]" showCloseButton={!busy}>
        <DialogHeader className="flex-row items-center gap-1.5 space-y-0 pr-8">
          <DialogTitle className="text-base">添加账号</DialogTitle>
          <button
            type="button"
            className="text-muted-foreground"
            aria-label="授权说明"
            title="点选平台后打开登录页，在账号浏览器里完成授权"
          >
            <CircleHelp className="size-4" />
          </button>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索平台"
            placeholder="搜索平台"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Tabs
          className="min-w-0"
          value={group}
          onValueChange={(value) => setGroup(value as PlatformGroupId)}
        >
          <TabsList
            aria-label="平台分组"
            className="h-10! w-full group-data-[orientation=horizontal]/tabs:h-10!"
          >
            {platformGroups.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="px-4">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={group} className="h-[min(520px,60vh)] flex-none overflow-y-auto">
            {visible.length === 0 && !showOther ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                没有匹配的平台
              </p>
            ) : (
              <div className="grid grid-cols-9 gap-x-3 gap-y-5">
                {visible.map((id) => {
                  const info = platformInfo[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={busy}
                      className="flex flex-col items-center gap-2 rounded-xl px-1 py-1 text-center hover:bg-muted disabled:opacity-50"
                      onClick={() => authorize(id)}
                    >
                      {platformIcons[id] ? (
                        <img
                          src={platformIcons[id]}
                          alt=""
                          className="size-14 rounded-[18px] object-cover"
                        />
                      ) : (
                        <span
                          className="platform-mark rounded-[18px] text-xl"
                          style={{ background: info.color, width: 56, height: 56 }}
                          aria-hidden="true"
                        >
                          {info.mark}
                        </span>
                      )}
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {info.label}
                      </span>
                    </button>
                  );
                })}
                {showOther && (
                  <button
                    type="button"
                    className="flex flex-col items-center gap-2 rounded-xl px-1 py-1 text-center hover:bg-muted"
                    onClick={() => setNotice("告诉我还要加哪个平台，我再补登录入口。")}
                  >
                    <span
                      className="platform-mark rounded-[18px] border border-dashed border-border bg-transparent text-muted-foreground"
                      style={{ width: 56, height: 56 }}
                    >
                      <Globe className="size-6" />
                    </span>
                    <span className="text-xs text-muted-foreground">其他账号</span>
                  </button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
