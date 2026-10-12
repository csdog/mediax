import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  Settings,
  Users,
  Send,
  History,
  Plus,
  ExternalLink,
  ImagePlus,
  FileText,
  Save,
  Monitor,
  CheckCircle2,
  X,
  CircleHelp,
  ChevronDown,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type {
  BrowserPreview,
  AccountInfo,
  ImageAsset,
  Task,
  TaskTarget,
  DesktopPage,
  Target,
  TabAction,
} from "../shared/models";
import { SettingsLayout } from "./components/SettingsLayout";
import { AccountManagement } from "./components/AccountManagement";
import "./style.css";
export function App() {
  const [page, setPage] = useState<DesktopPage>("accounts"),
    [accounts, setAccounts] = useState<AccountInfo[]>([]),
    [name, setName] = useState(""),
    [body, setBody] = useState(""),
    [images, setImages] = useState<ImageAsset[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [records, setRecords] = useState<{ tasks: Task[]; targets: TaskTarget[] }>({
      tasks: [],
      targets: [],
    });
  const [verifyDialogTarget, setVerifyDialogTarget] = useState<TaskTarget | null>(null);
  const [verifyUrl, setVerifyUrl] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<Target[]>([]);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<"facebook" | null>(null);
  const [browserTabs, setBrowserTabs] = useState<{ id: string; name: string; kind?: "new" }[]>([]);
  const closedTabs = useRef<{ id: string; name: string; kind?: "new" }[]>([]);
  const [activeBrowser, setActiveBrowser] = useState<string | null>(null);
  const isNewTab = browserTabs.some((tab) => tab.id === activeBrowser && tab.kind === "new");
  const activeAccountId = isNewTab ? null : activeBrowser;
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [tabPreview, setTabPreview] = useState<{
    id: string;
    data?: BrowserPreview;
    cover?: string | null;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTabPreview(null);
    if (!hoveredTab) return;
    void (async () => {
      try {
        if (
          hoveredTab === "workspace" ||
          browserTabs.some((tab) => tab.id === hoveredTab && tab.kind === "new")
        ) {
          const cover = activeAccountId
            ? (await window.desktop.previewAccountBrowser(activeAccountId)).image
            : null;
          if (!cancelled) setTabPreview({ id: hoveredTab, cover });
          return;
        }
        const data = await window.desktop.previewAccountBrowser(hoveredTab);
        const cover =
          activeAccountId && activeAccountId !== hoveredTab
            ? (await window.desktop.previewAccountBrowser(activeAccountId)).image
            : data.image;
        if (!cancelled) setTabPreview({ id: hoveredTab, data, cover });
      } catch {
        if (!cancelled) setTabPreview({ id: hoveredTab, error: "暂时无法预览页面" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hoveredTab, activeAccountId, browserTabs]);
  const previewVisible = Boolean(hoveredTab && tabPreview?.id === hoveredTab);
  const browserPane = useRef<HTMLDivElement>(null);
  const [overlayCover, setOverlayCover] = useState<{ id: string; image: string } | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcut, setShortcut] = useState("");
  const [shortcutMessage, setShortcutMessage] = useState("");
  const [shortcutBusy, setShortcutBusy] = useState(false);
  const openSettings = async () => {
    setSettingsOpen(true);
    setShortcutBusy(true);
    setShortcutMessage("");
    try {
      const settings = await window.desktop.shortcutSettings();
      setShortcut(settings.accelerator);
      setShortcutMessage(settings.error ?? "");
    } catch (error) {
      setShortcutMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setShortcutBusy(false);
    }
  };
  useEffect(() => {
    if (!settingsOpen) return;
    document.getElementById("settings-page-title")?.focus();
    const back = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !shortcutBusy) {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [settingsOpen, shortcutBusy]);
  const [initialized, setInitialized] = useState(false);
  const [focusedTask, setFocusedTask] = useState<string | undefined>();
  const openBrowser = async (account: { id: string; name: string }) => {
    setHoveredTab(null);
    setBrowserTabs((tabs) => {
      const remaining = isNewTab ? tabs.filter((tab) => tab.id !== activeBrowser) : tabs;
      return remaining.some((tab) => tab.id === account.id) ? remaining : [...remaining, account];
    });
    setActiveBrowser(account.id);
    await window.desktop.openAccount(account.id);
    setAccounts(await window.desktop.accounts());
  };
  useEffect(() => {
    const pane = browserPane.current;
    let revision = 0;
    const update = async () => {
      const current = ++revision;
      const rect = pane?.getBoundingClientRect();
      const bounds = rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined;
      try {
        if (settingsOpen || !activeBrowser || !rect) {
          await window.desktop.layoutAccountBrowser(null);
          if (current === revision) setOverlayCover(null);
          return;
        }
        const overlapping = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-slot="popover-content"]:not([data-avatar-menu]), [data-slot="hover-card-content"], [data-slot="dialog-content"]',
          ),
        ].some((element) => {
          if (element.dataset.state === "closed") return false;
          const overlay = element.getBoundingClientRect();
          return (
            overlay.width > 0 &&
            overlay.height > 0 &&
            overlay.left < rect.right &&
            overlay.right > rect.left &&
            overlay.top < rect.bottom &&
            overlay.bottom > rect.top
          );
        });
        if (overlapping) {
          const image =
            previewVisible && tabPreview?.cover
              ? tabPreview.cover
              : (await window.desktop.previewAccountBrowser(activeBrowser)).image;
          if (current !== revision) return;
          if (image) {
            // Keep the page visible before hiding the native view beneath a renderer overlay.
            flushSync(() => setOverlayCover({ id: activeBrowser, image }));
            await window.desktop.layoutAccountBrowser(null);
            return;
          }
        }
        if (current !== revision) return;
        await window.desktop.layoutAccountBrowser(activeBrowser, bounds);
        if (current === revision) setOverlayCover(null);
      } catch (error) {
        if (current === revision) setNotice(String(error));
      }
    };
    void update();
    const observer = pane ? new ResizeObserver(() => void update()) : null;
    if (pane) observer?.observe(pane);
    const resize = () => void update();
    window.addEventListener("resize", resize);
    return () => {
      revision++;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [activeBrowser, settingsOpen, accountDialogOpen, avatarMenuOpen, hoveredTab, previewVisible]);
  const reload = async () => {
    setAccounts(await window.desktop.accounts());
    setRecords(await window.desktop.history());
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run(async () => {
      const loadedAccounts = await window.desktop.accounts();
      setAccounts(loadedAccounts);
      setRecords(await window.desktop.history());
      const saved = await window.desktop.workspaceSession?.();
      if (saved && Array.isArray(saved.tabs)) {
        const restored = saved.tabs.flatMap((tab) => {
          if (tab.kind === "new") return [{ ...tab, name: "新标签页" }];
          const account = loadedAccounts.find((a) => a.id === tab.id);
          return account ? [{ id: account.id, name: account.name }] : [];
        });
        setBrowserTabs(restored);
        setPage(saved.page);
        for (const tab of restored) {
          if (tab.kind === "new") continue;
          try {
            await window.desktop.openAccount(tab.id);
          } catch (error) {
            setNotice(`恢复 ${tab.name} 失败：${String(error)}`);
          }
        }
        setActiveBrowser(restored.some((tab) => tab.id === saved.activeId) ? saved.activeId : null);
      }
      const d = await window.desktop.loadDraft();
      setBody(d.body);
      setImages(d.images);
      setInitialized(true);
    });
  }, []);
  useEffect(() => {
    if (!initialized) return;
    void window.desktop
      .saveWorkspaceSession?.({
        tabs: browserTabs.map(({ id, kind }) => (kind === "new" ? { id, kind } : { id })),
        activeId: activeBrowser,
        page,
      })
      ?.catch((error) => setNotice(`保存标签页失败：${String(error)}`));
  }, [initialized, browserTabs, activeBrowser, page]);
  useEffect(() => {
    if (!initialized) return;
    const timer = window.setInterval(() => {
      void window.desktop
        .history()
        .then(setRecords)
        .catch(() => {});
    }, 1500);
    return () => window.clearInterval(timer);
  }, [initialized]);
  useEffect(() => {
    if (!initialized) return;
    return window.desktop.onCommand?.((command) => {
      if (busy && command.action !== "navigate") return;
      if (command.action === "tab") {
        if (!settingsOpen && !accountDialogOpen && !publishDialogOpen && !verifyDialogTarget)
          handleTabCommand(command.operation);
      } else if (command.action === "settings") {
        void openSettings();
      } else if (command.action === "navigate") {
        setSettingsOpen(false);
        setActiveBrowser(null);
        setPage(command.page);
        setFocusedTask(command.taskId);
        void run(reload);
        if (command.page === "compose")
          requestAnimationFrame(() => document.getElementById("post-body")?.focus());
      } else if (command.action === "save-draft") {
        void run(async () => {
          await window.desktop.saveDraft(body, images);
          setNotice("草稿已保存到本机");
        });
      } else if (command.action === "import-markdown") {
        setSettingsOpen(false);
        setActiveBrowser(null);
        setPage("compose");
        void run(async () => {
          const text = await window.desktop.importMarkdown();
          if (text !== null) setBody(text);
        });
      }
    });
  }, [
    body,
    images,
    initialized,
    busy,
    browserTabs,
    activeBrowser,
    settingsOpen,
    accountDialogOpen,
    publishDialogOpen,
    verifyDialogTarget,
  ]);
  const closeBrowserTab = async (id: string) => {
    setHoveredTab(null);
    if (browserTabs.find((tab) => tab.id === id)?.kind !== "new")
      await window.desktop.closeAccountBrowser(id);
    const index = browserTabs.findIndex((tab) => tab.id === id);
    const closed = browserTabs[index];
    if (closed) closedTabs.current = [...closedTabs.current.slice(-19), closed];
    setBrowserTabs((tabs) => tabs.filter((tab) => tab.id !== id));
    if (activeBrowser === id)
      setActiveBrowser(browserTabs[index + 1]?.id ?? browserTabs[index - 1]?.id ?? null);
  };
  const newBrowserTab = () => {
    const tab = { id: `new-${crypto.randomUUID()}`, name: "新标签页", kind: "new" as const };
    setHoveredTab(null);
    setBrowserTabs((tabs) => [...tabs, tab]);
    setActiveBrowser(tab.id);
  };
  const handleTabCommand = (operation: TabAction) => {
    setHoveredTab(null);
    if (operation === "new") newBrowserTab();
    else if (operation === "close" && activeBrowser) void run(() => closeBrowserTab(activeBrowser));
    else if (operation === "next" || operation === "previous") {
      const ids = [null, ...browserTabs.map((tab) => tab.id)];
      const index = ids.indexOf(activeBrowser);
      setActiveBrowser(ids[(index + (operation === "next" ? 1 : ids.length - 1)) % ids.length]);
    } else if (operation === "reopen") {
      const tab = closedTabs.current.pop();
      if (!tab) return;
      if (tab.kind === "new") {
        setBrowserTabs((tabs) => [...tabs, tab]);
        setActiveBrowser(tab.id);
      } else if (accounts.some((a) => a.id === tab.id)) void run(() => openBrowser(tab));
    }
  };
  const nav: { id: DesktopPage; title: string; icon: typeof Users }[] = [
    { id: "accounts", title: "账号管理", icon: Users },
    { id: "compose", title: "内容发布", icon: Send },
    { id: "history", title: "发布记录", icon: History },
  ];
  const pageTitle = nav.find((n) => n.id === page)?.title;
  const settingsContent = (
    <SettingsLayout onBack={() => setSettingsOpen(false)}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (shortcutBusy) return;
          setShortcutBusy(true);
          setShortcutMessage("");
          try {
            const settings = await window.desktop.setGlobalShortcut(shortcut);
            setShortcut(settings.accelerator);
            setShortcutMessage(
              settings.registered
                ? "已保存，可在其他应用中按快捷键呼出窗口。"
                : "已关闭全局呼出快捷键。",
            );
          } catch (error) {
            setShortcutMessage(error instanceof Error ? error.message : String(error));
          } finally {
            setShortcutBusy(false);
          }
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
  );
  return (
    <TooltipProvider>
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>添加账号</DialogTitle>
            <DialogDescription>选择平台，打开独立浏览器完成登录授权。</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || platform !== "facebook") return;
              void run(async () => {
                const account = await window.desktop.addAccount(
                  name.trim() || `Facebook 账号 ${accounts.length + 1}`,
                );
                await reload();
                setAccountDialogOpen(false);
                await openBrowser(account);
                setNotice("请在账号浏览器中完成登录，返回后点击「检查状态」。");
              });
            }}
          >
            <div className="space-y-2">
              <Label>选择平台</Label>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-between p-4"
                aria-pressed={platform === "facebook"}
                disabled={busy}
                onClick={() => setPlatform("facebook")}
              >
                <span className="text-left">
                  <span className="block">Facebook</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    个人主页与公共主页
                  </span>
                </span>
                {platform === "facebook" && <CheckCircle2 />}
              </Button>
              <p className="text-xs text-muted-foreground">首版支持 Facebook，其他平台后续开放。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">账号名称（可选）</Label>
              <Input
                id="account-name"
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：个人账号 / 工作账号"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAccountDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy || !platform}>
                {busy ? "正在打开…" : "开始授权"}
                <ExternalLink />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(verifyDialogTarget)}
        onOpenChange={(open) => {
          if (!open) setVerifyDialogTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核验发布结果</DialogTitle>
            <DialogDescription>
              此操作只检查帖子，不会重新发布。可填写你在 Facebook
              找到的本次帖子链接，留空则检查已有提交证据。
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="verify-post-url">帖子链接</Label>
          <Input
            id="verify-post-url"
            value={verifyUrl}
            onChange={(event) => setVerifyUrl(event.target.value)}
            placeholder="https://www.facebook.com/…/posts/…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogTarget(null)}>
              取消
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.desktop.verifyTarget(
                    verifyDialogTarget!.id,
                    verifyUrl.trim() || undefined,
                  );
                  setVerifyDialogTarget(null);
                  await reload();
                  setNotice("已核验帖子作者与内容");
                })
              }
            >
              核验帖子
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open);
          if (!open) setAvatarMenuOpen(false);
        }}
        className={`workspace ${settingsOpen ? "settings-active" : ""}`}
        style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      >
        <div className="app-toolbar window-drag">
          <div className="toolbar-navigation window-no-drag">
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
          <div className="tab-strip window-no-drag">
            <div
              className="browser-tabs"
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
                onOpenChange={(open) => setHoveredTab(open ? "workspace" : null)}
              >
                <HoverCardTrigger
                  delay={400}
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
                  className="w-72 overflow-hidden p-0"
                  aria-label="工作区预览"
                >
                  <div className="space-y-1 px-3 py-2.5">
                    <p className="text-sm font-medium">{pageTitle}</p>
                    <p className="text-xs text-muted-foreground">media-post · 本地工作空间</p>
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
                  onOpenChange={(open) => setHoveredTab(open ? tab.id : null)}
                >
                  <HoverCardTrigger
                    delay={400}
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
                    className="w-72 overflow-hidden p-0"
                    aria-label={`${tab.name} 页面预览`}
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
        {settingsOpen && (
          <main className="settings-full-page" aria-label="设置页面">
            {settingsContent}
          </main>
        )}
        <aside className="activity-rail" aria-label="快捷导航">
          <div className="flex flex-col gap-2">
            {nav.map((n) => (
              <Tooltip key={n.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`打开${n.title}`}
                      data-active={page === n.id}
                      onClick={() => {
                        setActiveBrowser(null);
                        setPage(n.id);
                        void run(reload);
                      }}
                    >
                      <n.icon className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent side="right">{n.title}</TooltipContent>
              </Tooltip>
            ))}
          </div>
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
                  className="mt-auto rounded-full"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="打开头像菜单"
                >
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[9px]">MP</AvatarFallback>
                  </Avatar>
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
              <div className="border-b px-2.5 py-2.5 mb-1">
                <p className="text-sm font-medium">media-post</p>
                <p className="mt-0.5 text-xs text-muted-foreground">本地工作空间</p>
              </div>
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
        </aside>
        <Sidebar className="border-0" variant="sidebar">
          <SidebarHeader className="px-2 py-2">
            <div className="flex h-8 items-center gap-1.5 px-2">
              <span className="text-sm font-semibold">media-post</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <Button
              variant="ghost"
              className="justify-start px-2 font-normal"
              onClick={() => {
                setActiveBrowser(null);
                setPage("compose");
                void run(reload);
              }}
            >
              <FileText className="size-3.5" />
              新建内容
            </Button>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-3">
              <SidebarGroupLabel className="px-3 text-xs font-normal">项目</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        className="h-9 px-3 font-normal"
                        isActive={page === n.id}
                        tooltip={n.title}
                        onClick={() => {
                          setActiveBrowser(null);
                          setPage(n.id);
                          void run(reload);
                        }}
                      >
                        <n.icon />
                        <span>{n.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
        <SidebarInset className="min-w-0 bg-background">
          <header className="document-toolbar">
            <span className="text-xs text-muted-foreground">工作空间</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs">
              {isNewTab
                ? "新标签页"
                : activeBrowser
                  ? browserTabs.find((tab) => tab.id === activeBrowser)?.name
                  : pageTitle}
            </span>
          </header>
          {isNewTab ? (
            <main className="new-tab-page">
              <div className="new-tab-content">
                <h1 className="text-lg font-medium">新标签页</h1>
                <p className="mt-2 text-sm text-muted-foreground">选择账号打开浏览器</p>
                <div className="mt-6 space-y-1">
                  {accounts.map((account) => (
                    <Button
                      key={account.id}
                      aria-label={account.name}
                      variant="ghost"
                      className="h-12 w-full justify-start gap-3 px-3 font-normal"
                      disabled={busy}
                      onClick={() => void run(() => openBrowser(account))}
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="text-xs">{account.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{account.name}</span>
                      <ExternalLink className="ml-auto size-4 text-muted-foreground" />
                    </Button>
                  ))}
                  {!accounts.length && (
                    <p className="py-4 text-sm text-muted-foreground">
                      添加账号后，即可在这里打开账号浏览器。
                    </p>
                  )}
                </div>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPlatform(null);
                    setName("");
                    setAccountDialogOpen(true);
                  }}
                >
                  <Plus />
                  添加账号
                </Button>
                {notice && (
                  <p role="status" className="mt-4 text-sm text-muted-foreground">
                    {notice}
                  </p>
                )}
              </div>
            </main>
          ) : activeBrowser ? (
            <div className="browser-workspace">
              <h1 className="sr-only">
                {browserTabs.find((tab) => tab.id === activeBrowser)?.name} · Facebook
              </h1>
              {notice && (
                <Alert role="status">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              <div ref={browserPane} className="account-browser-pane" aria-label="账号浏览器">
                {overlayCover?.id === activeBrowser && (
                  <img
                    className="browser-preview-cover"
                    src={overlayCover.image}
                    alt=""
                    aria-label="浏览器页面背景"
                  />
                )}
              </div>
            </div>
          ) : (
            <main
              className={`document-content ${page === "compose" ? "compose-content" : page === "accounts" ? "accounts-content" : ""}`}
            >
              <h1 className="sr-only">{pageTitle}</h1>
              {notice && (
                <Alert role="status">
                  <CircleHelp />
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              {page === "accounts" && (
                <AccountManagement
                  accounts={accounts}
                  busy={busy}
                  onAuthorize={() => {
                    setPlatform(null);
                    setName("");
                    setAccountDialogOpen(true);
                  }}
                  onOpen={(account) => void run(() => openBrowser(account))}
                  onRefresh={(ids) =>
                    void run(async () => {
                      for (const id of ids) {
                        const updated = await window.desktop.refreshAccount(id);
                        setAccounts((old) => old.map((a) => (a.id === id ? updated : a)));
                      }
                    })
                  }
                />
              )}
              {page === "compose" && (
                <div className="editor-workspace">
                  <section className="draft-pane" aria-label="内容编辑">
                    <div className="draft-intro">
                      <p className="text-xs text-muted-foreground">Facebook</p>
                      <h2>准备发布的内容</h2>
                      <p>在下方编辑正文，或导入 Markdown。右侧可查看发布效果。</p>
                      <div className="draft-note">
                        <Monitor />
                        正文、图片和草稿保存在这台 Mac 上
                      </div>
                    </div>
                    <div className="composer-dock">
                      <Card className="composer">
                        <Label htmlFor="post-body" className="sr-only">
                          发布正文
                        </Label>
                        <Textarea
                          id="post-body"
                          placeholder="写下要分享的内容…"
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                        />
                        {images.length > 0 && (
                          <div className="composer-images">
                            {images.map((i) => (
                              <div className="relative" key={i.path}>
                                <img
                                  className="size-14 rounded-lg border object-cover"
                                  src={i.preview}
                                  alt={i.name}
                                />
                                <Button
                                  variant="secondary"
                                  size="icon-xs"
                                  aria-label={`移除 ${i.name}`}
                                  onClick={() => setImages(images.filter((x) => x.path !== i.path))}
                                  className="absolute -right-1 -top-1 rounded-full"
                                >
                                  <X />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="composer-tools">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="选择图片"
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      const added = await window.desktop.chooseImages();
                                      setImages((old) => [
                                        ...old,
                                        ...added.filter((a) => !old.some((x) => x.path === a.path)),
                                      ]);
                                    })
                                  }
                                >
                                  <ImagePlus />
                                </Button>
                              }
                            />
                            <TooltipContent>选择图片</TooltipContent>
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const text = await window.desktop.importMarkdown();
                                if (text !== null) setBody(text);
                              })
                            }
                          >
                            <FileText />
                            导入 Markdown
                          </Button>
                          <span className="composer-count">{body.length} 字符</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await window.desktop.saveDraft(body, images);
                                setNotice("草稿已保存到本机");
                              })
                            }
                          >
                            <Save />
                            保存草稿
                          </Button>
                        </div>
                      </Card>
                      <p className="composer-caption">
                        {images.length ? `${images.length} 张图片 · ` : ""}支持正文与图片 ·
                        发布前请确认目标账号
                      </p>
                    </div>
                  </section>
                  <aside className="preview-pane" aria-label="内容预览与发布设置">
                    <div className="preview-toolbar">
                      <FileText />
                      <span>内容预览</span>
                      <span className="ml-auto text-xs text-muted-foreground">Facebook</span>
                    </div>
                    <div className="preview-document">
                      <div className="preview-meta">
                        <span className="preview-avatar">
                          <Users />
                        </span>
                        <div>
                          <span>Facebook 帖子</span>
                          <p>个人主页 / 公共主页</p>
                        </div>
                      </div>
                      <p className={`preview-body ${body ? "" : "preview-placeholder"}`}>
                        {body || "正文将在这里显示"}
                      </p>
                      {images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {images.map((i) => (
                            <img
                              key={i.path}
                              className="aspect-square w-full rounded-lg object-cover"
                              src={i.preview}
                              alt={i.name}
                            />
                          ))}
                        </div>
                      )}
                      <p className="preview-caption">实际排版以 Facebook 为准</p>
                    </div>
                    <div className="publish-inspector">
                      <h2>发布目标</h2>
                      <p>个人主页与公共主页</p>
                      <div className="space-y-3 py-3">
                        {accounts.flatMap((a) =>
                          a.targets.map((target) => {
                            const checked = selectedTargets.some(
                              (t) =>
                                t.accountId === target.accountId &&
                                t.identityId === target.identityId,
                            );
                            return (
                              <label
                                key={`${a.id}:${target.identityId}`}
                                className="flex items-start gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={busy}
                                  onCheckedChange={(value) =>
                                    setSelectedTargets((old) =>
                                      value
                                        ? [...old, target]
                                        : old.filter(
                                            (t) =>
                                              t.accountId !== target.accountId ||
                                              t.identityId !== target.identityId,
                                          ),
                                    )
                                  }
                                />
                                <span>
                                  {target.name}
                                  <span className="block text-xs text-muted-foreground">
                                    {a.name} · {target.kind === "profile" ? "个人主页" : "公共主页"}
                                  </span>
                                </span>
                              </label>
                            );
                          }),
                        )}
                        {!accounts.some((a) => a.targets.length) && (
                          <p className="text-xs text-muted-foreground">
                            在账号管理中检查登录状态，识别可发布身份。
                          </p>
                        )}
                      </div>
                      <div className="publish-actions">
                        <span>已选 {selectedTargets.length} 个目标</span>
                        <Button
                          disabled={
                            busy ||
                            !body.trim() ||
                            !selectedTargets.length ||
                            records.targets.some((t) =>
                              ["pending", "running", "awaiting_user"].includes(t.status),
                            )
                          }
                          size="sm"
                          onClick={() => setPublishDialogOpen(true)}
                        >
                          <Send />
                          发布
                        </Button>
                      </div>
                      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>确认发布</DialogTitle>
                            <DialogDescription>
                              将依次向以下目标发布，确认后开始提交。受众沿用 Facebook 当前设置。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2">
                            {selectedTargets.map((t) => (
                              <p key={`${t.accountId}:${t.identityId}`} className="text-sm">
                                {t.name} · {t.kind === "profile" ? "个人主页" : "公共主页"} ·{" "}
                                {accounts.find((a) => a.id === t.accountId)?.name}
                              </p>
                            ))}
                          </div>
                          <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-sm">
                            {body}
                          </div>
                          <p className="text-xs text-muted-foreground">{images.length} 张图片</p>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                              取消
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const taskId = await window.desktop.publish(
                                    body,
                                    images.map((i) => i.path),
                                    selectedTargets,
                                  );
                                  setPublishDialogOpen(false);
                                  setFocusedTask(taskId);
                                  await reload();
                                  setPage("history");
                                  setNotice(
                                    "任务已创建，将依次发布。需要人工处理时请打开对应账号标签页。",
                                  );
                                })
                              }
                            >
                              确认发布
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </aside>
                </div>
              )}
              {page === "history" && (
                <Card>
                  <CardHeader>
                    <CardTitle>发布记录</CardTitle>
                    <CardDescription>每个发布目标的状态分别记录。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {records.tasks.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>内容</TableHead>
                            <TableHead>目标</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>时间</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.tasks.flatMap((t) => {
                            const targets = records.targets.filter((x) => x.taskId === t.id);
                            return targets.map((x) => (
                              <TableRow
                                key={x.id}
                                className={focusedTask === t.id ? "bg-accent" : undefined}
                              >
                                <TableCell className="max-w-sm whitespace-pre-wrap">
                                  {t.body}
                                </TableCell>
                                <TableCell>{x.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {
                                      {
                                        pending: "排队中",
                                        running: "发布中",
                                        awaiting_user: "等待人工处理",
                                        submitted: "已提交，待核验",
                                        verified: "发布成功",
                                        failed: "失败",
                                        unknown: "结果未知",
                                      }[x.status]
                                    }
                                  </Badge>
                                  {x.url && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() =>
                                        void run(() => window.desktop.openPost(x.url!))
                                      }
                                    >
                                      查看帖子
                                    </Button>
                                  )}
                                  {[
                                    "pending",
                                    "awaiting_user",
                                    "failed",
                                    "submitted",
                                    "unknown",
                                  ].includes(x.status) && (
                                    <div className="mt-2 flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() =>
                                          void run(() =>
                                            openBrowser({
                                              id: x.accountId,
                                              name:
                                                accounts.find((a) => a.id === x.accountId)?.name ??
                                                x.name,
                                            }),
                                          )
                                        }
                                      >
                                        打开账号
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() =>
                                          void run(async () => {
                                            if (x.status === "failed")
                                              await window.desktop.retry(x.id);
                                            else if (["submitted", "unknown"].includes(x.status)) {
                                              setVerifyDialogTarget(x);
                                              setVerifyUrl(x.url ?? "");
                                            } else await window.desktop.resume(x.id);
                                            await reload();
                                          })
                                        }
                                      >
                                        {x.status === "failed"
                                          ? "重试"
                                          : ["submitted", "unknown"].includes(x.status)
                                            ? "核验结果"
                                            : "继续"}
                                      </Button>
                                    </div>
                                  )}
                                  {x.error && (
                                    <p className="mt-1 text-xs text-muted-foreground">{x.error}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {new Date(t.createdAt).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ));
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <Empty className="py-16">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <CheckCircle2 />
                          </EmptyMedia>
                          <EmptyTitle>暂无发布记录</EmptyTitle>
                          <EmptyDescription>
                            实际发布后，在这里查看各目标的状态和链接。
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </CardContent>
                </Card>
              )}
            </main>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
