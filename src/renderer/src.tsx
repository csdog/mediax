import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Users,
  Send,
  History,
  Plus,
  RefreshCw,
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import type { AccountInfo, ImageAsset, Task, TaskTarget } from "../shared/models";
import "./style.css";
export function App() {
  const [page, setPage] = useState("accounts"),
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
      await reload();
      const d = await window.desktop.loadDraft();
      setBody(d.body);
      setImages(d.images);
    });
  }, []);
  const nav = [
    { id: "accounts", title: "账号管理", icon: Users },
    { id: "compose", title: "内容发布", icon: Send },
    { id: "history", title: "发布记录", icon: History },
  ];
  const pageTitle = nav.find((n) => n.id === page)?.title;
  const loginLabels = {
    unchecked: "待检查",
    logged_in: "已检测到登录会话",
    logged_out: "未登录",
    needs_verification: "需要验证",
  };
  return (
    <TooltipProvider>
      <SidebarProvider
        className="workspace"
        style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      >
        <div className="app-toolbar window-drag">
          <div className="toolbar-navigation window-no-drag">
            <Button variant="ghost" size="icon-xs" aria-label="后退" disabled>
              <ArrowLeft />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="前进" disabled>
              <ArrowRight />
            </Button>
            <SidebarTrigger aria-label="切换侧栏" />
          </div>
          <div className="toolbar-tab">
            <FolderOpen className="size-3.5" />
            <span>{pageTitle}</span>
          </div>
          <div className="ml-auto px-4 text-xs text-muted-foreground">media-post</div>
        </div>
        <aside className="activity-rail" aria-label="快捷导航">
          <div className="flex flex-col gap-2">
            {nav.map((n) => (
              <Tooltip key={n.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`打开${n.title}`}
                    data-active={page === n.id}
                    onClick={() => {
                      setPage(n.id);
                      void run(reload);
                    }}
                  >
                    <n.icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{n.title}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Avatar className="mt-auto size-6">
            <AvatarFallback className="text-[9px]">MP</AvatarFallback>
          </Avatar>
        </aside>
        <Sidebar className="border-0" variant="sidebar">
          <SidebarHeader className="px-3 py-3">
            <div className="flex h-8 items-center gap-1.5 px-2">
              <span className="text-sm font-semibold">media-post</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <Button
              variant="ghost"
              className="justify-start px-2 text-[13px] font-normal"
              onClick={() => {
                setPage("compose");
                void run(reload);
              }}
            >
              <Plus className="size-3.5" />
              新建内容
            </Button>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-3">
              <SidebarGroupLabel className="px-3 text-[11px] font-normal">
                工作空间
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        className="h-9 px-3 font-normal"
                        isActive={page === n.id}
                        tooltip={n.title}
                        onClick={() => {
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
          <SidebarFooter className="p-4">
            <div className="flex items-center gap-2 px-2 pt-3 text-xs text-muted-foreground">
              <Monitor className="size-4" />
              本地工作空间
            </div>
            <p className="px-2 pb-2 text-[11px] text-muted-foreground">Facebook · macOS</p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0 bg-background">
          <header className="document-toolbar">
            <span className="text-xs text-muted-foreground">工作空间</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs">{pageTitle}</span>
            <Badge variant="outline" className="ml-auto font-normal text-[10px]">
              Facebook · 本地
            </Badge>
          </header>
          <main className={`document-content ${page === "compose" ? "compose-content" : ""}`}>
            <h1 className="sr-only">{pageTitle}</h1>
            {notice && (
              <Alert role="status">
                <CircleHelp />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {page === "accounts" && (
              <>
                <div className="account-summary flex flex-wrap gap-6">
                  {[
                    ["已添加账号", accounts.length],
                    ["已检测登录", accounts.filter((a) => a.login === "logged_in").length],
                    ["可发布目标", accounts.reduce((n, a) => n + a.targets.length, 0)],
                  ].map(([label, value]) => (
                    <Card key={label}>
                      <CardHeader>
                        <CardDescription>{label}</CardDescription>
                        <CardTitle className="text-base tabular-nums">{value}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>连接账号</CardTitle>
                    <CardDescription>为账号设置名称，再打开独立浏览器完成登录。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="flex items-end gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!busy && name.trim())
                          void run(async () => {
                            await window.desktop.addAccount(name);
                            setName("");
                            await reload();
                          });
                      }}
                    >
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="account-name">账号名称</Label>
                        <Input
                          id="account-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="例如：个人账号 / 工作账号"
                        />
                      </div>
                      <Button type="submit" disabled={busy || !name.trim()}>
                        <Plus />
                        添加账号
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                {accounts.length ? (
                  <div className="space-y-4">
                    {accounts.map((a) => (
                      <Card key={a.id}>
                        <CardContent className="flex flex-wrap items-center gap-4">
                          <Avatar className="size-11">
                            <AvatarFallback>{a.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-sm font-medium">{a.name}</h2>
                              <Badge variant="secondary">{loginLabels[a.login]}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {a.message ?? "独立浏览器会话 · 请打开浏览器完成登录"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const updated = await window.desktop.refreshAccount(a.id);
                                  setAccounts((old) =>
                                    old.map((x) => (x.id === a.id ? updated : x)),
                                  );
                                })
                              }
                            >
                              <RefreshCw />
                              检查状态
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={() => void run(() => window.desktop.openAccount(a.id))}
                            >
                              <ExternalLink />
                              打开浏览器
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Users />
                        </EmptyMedia>
                        <EmptyTitle>添加你的第一个账号</EmptyTitle>
                        <EmptyDescription>
                          每个账号使用独立的浏览器会话，互不影响。
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </Card>
                )}
              </>
            )}
            {page === "compose" && (
              <div className="editor-workspace grid items-start lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card>
                  <CardHeader>
                    <CardTitle>编辑内容</CardTitle>
                    <CardDescription>正文和图片会保存在本机，可随时继续编辑。</CardDescription>
                    <CardAction>
                      <Button
                        variant="outline"
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
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="post-body">发布正文</Label>
                      <Textarea
                        id="post-body"
                        placeholder="写下要分享的内容…"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="min-h-64 resize-y leading-7"
                      />
                      <p className="text-right text-xs text-muted-foreground">{body.length} 字符</p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>图片素材</Label>
                        <Button
                          variant="outline"
                          size="sm"
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
                          选择图片
                        </Button>
                      </div>
                      {images.length ? (
                        <div className="flex flex-wrap gap-3">
                          {images.map((i) => (
                            <div className="relative" key={i.path}>
                              <img
                                className="size-24 rounded-md border object-cover"
                                src={i.preview}
                                alt={i.name}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon-xs"
                                    aria-label={`移除 ${i.name}`}
                                    onClick={() =>
                                      setImages(images.filter((x) => x.path !== i.path))
                                    }
                                    className="absolute -right-2 -top-2 rounded-full"
                                  >
                                    <X />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>移除图片</TooltipContent>
                              </Tooltip>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty className="border border-dashed py-8">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <ImagePlus />
                            </EmptyMedia>
                            <EmptyTitle className="text-sm">添加图片，让内容更丰富</EmptyTitle>
                            <EmptyDescription>
                              可选：选择本地图片，与正文一起发布。
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end border-t">
                    <Button
                      variant="outline"
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
                  </CardFooter>
                </Card>
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>内容预览</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            <Users className="size-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">Facebook 帖子</p>
                          <p className="text-xs text-muted-foreground">正文与图片</p>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {body || "正文将在这里显示"}
                      </p>
                      {images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {images.map((i) => (
                            <img
                              key={i.path}
                              className="aspect-square w-full rounded-md border object-cover"
                              src={i.preview}
                              alt={i.name}
                            />
                          ))}
                        </div>
                      )}
                      <Separator />
                      <p className="text-xs text-muted-foreground">
                        内容预览，实际排版以 Facebook 为准
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>发布目标</CardTitle>
                      <CardDescription>选择个人主页或公共主页。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <CircleHelp />
                        <AlertDescription>
                          发布功能准备中。账号与公共主页验证完成后，即可选择目标。
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                    <CardFooter className="flex-col gap-3">
                      <Button className="w-full" disabled>
                        <Send />
                        发布
                      </Button>
                      <p className="text-xs text-muted-foreground">当前可编辑内容并保存草稿。</p>
                    </CardFooter>
                  </Card>
                </div>
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
                            <TableRow key={x.id}>
                              <TableCell className="max-w-sm whitespace-pre-wrap">
                                {t.body}
                              </TableCell>
                              <TableCell>{x.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{x.status}</Badge>
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
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
