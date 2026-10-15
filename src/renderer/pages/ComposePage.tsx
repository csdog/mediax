import { useEffect, useRef, useState } from "react";
import {
  Monitor,
  X,
  ImagePlus,
  FileText,
  Save,
  Send,
  Plus,
  RefreshCw,
  FolderOpen,
  CalendarClock,
} from "lucide-react";
import { applyLocalFiles, pathsFromDataTransfer } from "@/lib/importLocalFiles";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import { isAudio, isVideo, supportedKinds } from "../../shared/content";
import type { AccountInfo, ContentKind, PlatformId, Target } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";
import { platformIcons } from "@/assets/platformIcons";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useWorkspace } from "@/app/WorkspaceContext";
import { useDesktopBehavior } from "@/hooks/useDesktopBehavior";
import { resolveTimeZone } from "../../shared/timezones";

export function ComposePage() {
  const {
    body,
    setBody,
    contentKind,
    setContentKind,
    title,
    setTitle,
    images,
    setImages,
    busy,
    run,
    setNotice,
    accounts,
    selectedTargets,
    setSelectedTargets,
    records,
    publishDialogOpen,
    setPublishDialogOpen,
    setFocusedTask,
    reload,
    page,
    setPage,
    silentPublish,
    setActiveBrowser,
    composeScheduleAt,
    clearComposeSchedule,
  } = useWorkspace();
  const { settings: desktopBehavior } = useDesktopBehavior();
  const scheduleTimeZone = resolveTimeZone(desktopBehavior.calendarTimezone);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformId | "all">("all");
  const [platformQuery, setPlatformQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [syncedSignature, setSyncedSignature] = useState("");
  const [dragging, setDragging] = useState(false);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState(() => hoursFromNow(1));
  const [scheduleFromCalendar, setScheduleFromCalendar] = useState(false);
  const clearComposeScheduleRef = useRef(clearComposeSchedule);
  clearComposeScheduleRef.current = clearComposeSchedule;

  useEffect(() => {
    if (!composeScheduleAt) return;
    const min = minutesFromNow(2);
    setPublishMode("schedule");
    setScheduleAt(composeScheduleAt.getTime() < min.getTime() ? min : composeScheduleAt);
    setScheduleFromCalendar(true);
    clearComposeScheduleRef.current();
  }, [composeScheduleAt]);
  const importPaths = (paths: string[]) => {
    if (!paths.length) return;
    void run(async () => {
      const result = await applyLocalFiles(paths, contentKind, images);
      if (result.markdown != null) setBody(result.markdown);
      setImages(result.images);
      setNotice(result.notice);
    });
  };
  const paths = images.map((image) => image.path);
  const ready = canPublish(contentKind, title, body, paths);
  const signature = [
    contentKind,
    title,
    body,
    paths.join("\n"),
    selectedTargets
      .map((target) => `${target.accountId}:${target.identityId}`)
      .sort()
      .join("\n"),
  ].join("\0");
  const synced = syncedSignature === signature && selectedTargets.length > 0 && ready;
  const publishing = records.targets.some((target) =>
    ["pending", "running", "awaiting_user"].includes(target.status),
  );
  const eligible = accounts.filter(
    (account) => supportedKinds(account.platform).includes(contentKind) && account.targets.length,
  );
  const switchKind = (kind: ContentKind) => {
    if (kind === contentKind) return;
    setContentKind(kind);
    setImages([]);
    setSelectedTargets((current) =>
      current.filter((target) => {
        const account = accounts.find((item) => item.id === target.accountId);
        return account ? supportedKinds(account.platform).includes(kind) : false;
      }),
    );
  };
  const toggleTarget = (target: Target, value: boolean) => {
    setSelectedTargets((old) =>
      value
        ? old.some((item) => sameTarget(item, target))
          ? old
          : [...old, target]
        : old.filter((item) => !sameTarget(item, target)),
    );
  };
  const openPicker = () => {
    setPlatformFilter("all");
    setPlatformQuery("");
    setAccountQuery("");
    setPickerOpen(true);
  };
  return (
    <DocumentPage>
      <div className="editor-workspace publish-flow">
        <aside className="publish-accounts" aria-label="发布账号">
          <div className="flex items-center justify-between gap-2">
            <h2>发布账号</h2>
            <span className="text-xs text-muted-foreground">共 {selectedTargets.length} 个</span>
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={openPicker}>
            <Plus />
            新增账号
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">快速填写后，同步到勾选的账号。</p>
          <div className="publish-account-list mt-3 space-y-3">
            {pickerOpen ? (
              <p className="text-xs text-muted-foreground">在弹窗里勾选账号，确认添加。</p>
            ) : (
              eligible.flatMap((account) =>
                account.targets.map((target) => (
                  <TargetChoice
                    key={`${account.id}:${target.identityId}`}
                    account={account}
                    target={target}
                    checked={selectedTargets.some((item) => sameTarget(item, target))}
                    pending={synced && selectedTargets.some((item) => sameTarget(item, target))}
                    disabled={busy}
                    onCheckedChange={(value) => toggleTarget(target, value)}
                  />
                )),
              )
            )}
            {!eligible.length && (
              <p className="text-xs text-muted-foreground">
                在账号管理中检查登录状态，识别可发布身份。
              </p>
            )}
          </div>
        </aside>
        <section className="draft-pane" aria-label="内容编辑">
          <div className="publish-toolbar">
            <div>
              <p className="text-xs text-muted-foreground">快速填写</p>
              <h2>发布{kindCaption(contentKind)}</h2>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !ready || !selectedTargets.length}
                onClick={() => {
                  if (!ready || !selectedTargets.length) return;
                  setSyncedSignature(signature);
                  setNotice(`已同步到 ${selectedTargets.length} 个账号`);
                }}
              >
                <RefreshCw />
                同步到账号
              </Button>
              <Button
                size="sm"
                disabled={busy || !synced || publishing}
                onClick={() => setPublishDialogOpen(true)}
              >
                <Send />
                一键发布
              </Button>
            </div>
          </div>
          <div className="draft-note">
            <Monitor />
            先勾选账号，填写内容，同步到账号，再一键发布
          </div>
          {scheduleFromCalendar && publishMode === "schedule" ? (
            <div className="draft-note mediax-compose-schedule-banner">
              <CalendarClock />
              <span>
                日历排期：
                {new Intl.DateTimeFormat("zh-CN", {
                  timeZone: scheduleTimeZone,
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(scheduleAt)}{" "}
                ({scheduleTimeZone})，确认发布时可再修改
              </span>
              <button
                type="button"
                className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setScheduleFromCalendar(false);
                  setPublishMode("now");
                }}
              >
                改为立即发布
              </button>
            </div>
          ) : null}
          <div className="composer-dock">
            <Card
              className={`composer ${dragging ? "composer-drop-active" : ""}`}
              onDragEnter={(event) => {
                if (![...event.dataTransfer.types].includes("Files")) return;
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => {
                if (![...event.dataTransfer.types].includes("Files")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                importPaths(pathsFromDataTransfer(event.dataTransfer));
              }}
            >
              {dragging ? (
                <div className="composer-drop-hint" aria-live="polite">
                  松开以导入 Markdown 或素材
                </div>
              ) : null}
              {page === "video" ? null : (
                <div
                  className="flex flex-wrap gap-2 px-3 pt-3"
                  role="radiogroup"
                  aria-label="内容类型"
                >
                  {(
                    [
                      ["moment", "图文"],
                      ["article", "文章"],
                      ["audio", "音频"],
                    ] as const
                  ).map(([kind, label]) => (
                    <Button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={contentKind === kind}
                      variant={contentKind === kind ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => switchKind(kind)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              {contentKind === "article" && (
                <div className="px-3 pt-3">
                  <Label htmlFor="post-title">文章标题</Label>
                  <Input
                    id="post-title"
                    value={title}
                    maxLength={80}
                    placeholder="填写文章标题"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
              )}
              <Label htmlFor="post-body" className="sr-only">
                发布正文
              </Label>
              <Textarea
                id="post-body"
                placeholder="写下要分享的内容…"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <p className={`preview-body px-3 ${body ? "" : "preview-placeholder"}`}>
                {body || "正文将在这里显示"}
              </p>
              {images.length > 0 && (
                <div className="composer-images">
                  {images.map((image) => (
                    <div className="relative" key={image.path}>
                      {image.preview ? (
                        <img
                          className="size-14 rounded-lg border object-cover"
                          src={image.preview}
                          alt={image.name}
                        />
                      ) : (
                        <div
                          className="flex size-14 items-center justify-center rounded-lg border text-[10px] text-muted-foreground"
                          title={image.name}
                        >
                          媒体
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        aria-label={`移除 ${image.name}`}
                        onClick={() => setImages(images.filter((item) => item.path !== image.path))}
                        className="absolute -top-1 -right-1 rounded-full"
                      >
                        <X />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        aria-label={`在 Finder 中显示 ${image.name}`}
                        onClick={() =>
                          void run(async () => {
                            await window.desktop.revealInFolder(image.path);
                          })
                        }
                        className="absolute -bottom-1 -left-1 rounded-full"
                      >
                        <FolderOpen />
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
                        aria-label={mediaLabel(contentKind)}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const added = await window.desktop.chooseImages(contentKind);
                            setImages((old) => [
                              ...old,
                              ...added.filter(
                                (item) => !old.some((image) => image.path === item.path),
                              ),
                            ]);
                          })
                        }
                      >
                        <ImagePlus />
                      </Button>
                    }
                  />
                  <TooltipContent>{mediaLabel(contentKind)}（也可拖入）</TooltipContent>
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
                      await window.desktop.saveDraft(body, images, contentKind, title);
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
              {images.length ? `${images.length} 个素材 · ` : ""}
              {synced ? `已同步 ${selectedTargets.length} 个账号` : "填写后同步到账号，再一键发布"}
            </p>
          </div>
        </section>
        <AccountPicker
          open={pickerOpen}
          accounts={eligible}
          selectedTargets={selectedTargets}
          platformFilter={platformFilter}
          platformQuery={platformQuery}
          accountQuery={accountQuery}
          busy={busy}
          synced={synced}
          onOpenChange={setPickerOpen}
          onPlatformFilter={setPlatformFilter}
          onPlatformQuery={setPlatformQuery}
          onAccountQuery={setAccountQuery}
          onToggle={toggleTarget}
          onReplace={setSelectedTargets}
        />
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认发布</DialogTitle>
              <DialogDescription>
                同一份内容会发到所选账号。定时发布需保持 MediaX 在运行，到点后自动入队。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <RadioGroup
                value={publishMode}
                onValueChange={(value) => setPublishMode(value as "now" | "schedule")}
                className="grid gap-2 sm:grid-cols-2"
              >
                <FieldLabel>
                  <Field orientation="horizontal">
                    <RadioGroupItem value="now" />
                    <FieldTitle>立即发布</FieldTitle>
                  </Field>
                </FieldLabel>
                <FieldLabel>
                  <Field orientation="horizontal">
                    <RadioGroupItem value="schedule" />
                    <FieldTitle>定时发布</FieldTitle>
                  </Field>
                </FieldLabel>
              </RadioGroup>
              {publishMode === "schedule" ? (
                <div className="space-y-2">
                  <Label htmlFor="schedule-at">发布时间</Label>
                  <DateTimePicker
                    id="schedule-at"
                    value={scheduleAt}
                    min={minutesFromNow(2)}
                    timeZone={scheduleTimeZone}
                    size="lg"
                    onChange={setScheduleAt}
                  />
                  <p className="text-xs text-muted-foreground">
                    按 {scheduleTimeZone} 解释；关机或退出应用将无法到点发布。
                  </p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              {selectedTargets.map((target) => {
                const account = accounts.find((item) => item.id === target.accountId);
                return (
                  <p key={`${target.accountId}:${target.identityId}`} className="text-sm">
                    {account ? platformInfo[account.platform].label : "账号"} · {target.name} ·{" "}
                    {account?.name} · {target.kind === "profile" ? "个人主页" : "公共主页"}
                  </p>
                );
              })}
            </div>
            {contentKind === "article" && <p className="text-sm font-medium">{title}</p>}
            <div className="max-h-60 overflow-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {body || "无正文"}
            </div>
            <p className="text-xs text-muted-foreground">
              {images.length} 个素材 · {kindCaption(contentKind)}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button
                disabled={busy || !ready}
                onClick={() =>
                  void run(async () => {
                    const scheduledAt =
                      publishMode === "schedule" ? scheduleAt.toISOString() : null;
                    const taskId = await window.desktop.publish(
                      contentKind,
                      contentKind === "article" ? title : null,
                      body,
                      paths,
                      selectedTargets,
                      scheduledAt,
                    );
                    setPublishDialogOpen(false);
                    setFocusedTask(taskId);
                    if (silentPublish) setActiveBrowser(null);
                    await reload();
                    setPage(publishMode === "schedule" ? "calendar" : "history");
                    setNotice(
                      publishMode === "schedule"
                        ? "已加入排期；保持应用运行，到点后将自动发布。"
                        : "任务已创建，将按并行设置发布。需要人工处理时请打开对应账号标签页。",
                    );
                  })
                }
              >
                {publishMode === "schedule" ? "确认排期" : "确认发布"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DocumentPage>
  );
}

function AccountPicker({
  open,
  accounts,
  selectedTargets,
  platformFilter,
  platformQuery,
  accountQuery,
  busy,
  synced,
  onOpenChange,
  onPlatformFilter,
  onPlatformQuery,
  onAccountQuery,
  onToggle,
  onReplace,
}: {
  open: boolean;
  accounts: AccountInfo[];
  selectedTargets: Target[];
  platformFilter: PlatformId | "all";
  platformQuery: string;
  accountQuery: string;
  busy: boolean;
  synced: boolean;
  onOpenChange: (open: boolean) => void;
  onPlatformFilter: (id: PlatformId | "all") => void;
  onPlatformQuery: (value: string) => void;
  onAccountQuery: (value: string) => void;
  onToggle: (target: Target, value: boolean) => void;
  onReplace: (targets: Target[]) => void;
}) {
  const platformKeyword = platformQuery.trim().toLowerCase();
  const accountKeyword = accountQuery.trim().toLowerCase();
  const platforms = [...new Set(accounts.map((account) => account.platform))].filter((id) =>
    platformInfo[id].label.toLowerCase().includes(platformKeyword),
  );
  const visibleAccounts = accounts.filter(
    (account) => platformFilter === "all" || account.platform === platformFilter,
  );
  const visibleTargets = visibleAccounts.flatMap((account) =>
    account.targets
      .filter((target) => {
        const accountName = account.name.toLowerCase();
        const targetName = target.name.toLowerCase();
        return accountName.includes(accountKeyword) || targetName.includes(accountKeyword);
      })
      .map((target) => ({ account, target })),
  );
  const allChecked =
    visibleTargets.length > 0 &&
    visibleTargets.every(({ target }) => selectedTargets.some((item) => sameTarget(item, target)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>选择账号</DialogTitle>
          <DialogDescription>勾选本次要发布的账号，确认后再同步内容。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-80 grid-cols-[200px_minmax(0,1fr)] gap-3">
          <div className="space-y-2">
            <Input
              aria-label="搜索平台"
              placeholder="搜索平台"
              value={platformQuery}
              onChange={(event) => onPlatformQuery(event.target.value)}
            />
            <div className="max-h-64 space-y-1 overflow-auto">
              {"全部平台".includes(platformQuery.trim()) && (
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${platformFilter === "all" ? "bg-muted" : ""}`}
                  onClick={() => onPlatformFilter("all")}
                >
                  全部平台
                </button>
              )}
              {platforms.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${platformFilter === id ? "bg-muted" : ""}`}
                  onClick={() => onPlatformFilter(id)}
                >
                  <PlatformMark id={id} />
                  {platformInfo[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allChecked}
                  disabled={busy || !visibleTargets.length}
                  onCheckedChange={(value) => {
                    const keys = new Set(visibleTargets.map(({ target }) => targetKey(target)));
                    onReplace(
                      value
                        ? [
                            ...selectedTargets.filter((target) => !keys.has(targetKey(target))),
                            ...visibleTargets.map(({ target }) => target),
                          ]
                        : selectedTargets.filter((target) => !keys.has(targetKey(target))),
                    );
                  }}
                />
                全选
              </label>
              <Input
                aria-label="搜索账号"
                placeholder="输入账号名称"
                value={accountQuery}
                onChange={(event) => onAccountQuery(event.target.value)}
              />
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto">
              {visibleTargets.map(({ account, target }) => (
                <TargetChoice
                  key={`${account.id}:${target.identityId}`}
                  account={account}
                  target={target}
                  checked={selectedTargets.some((item) => sameTarget(item, target))}
                  pending={synced && selectedTargets.some((item) => sameTarget(item, target))}
                  disabled={busy}
                  onCheckedChange={(value) => onToggle(target, value)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            已选择 {selectedTargets.length} 个账号
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={() => onOpenChange(false)}>确认添加</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetChoice({
  account,
  target,
  checked,
  pending,
  disabled,
  onCheckedChange,
}: {
  account: AccountInfo;
  target: Target;
  checked: boolean;
  pending: boolean;
  disabled: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const info = platformInfo[account.platform];
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <PlatformMark id={account.platform} />
      <span>
        {target.name}
        <span className="block text-xs text-muted-foreground">
          {info.label} · {account.name} · {target.kind === "profile" ? "个人主页" : "公共主页"}
          {pending ? " · 待发布" : ""}
        </span>
      </span>
    </label>
  );
}

function PlatformMark({ id }: { id: PlatformId }) {
  const icon = platformIcons[id];
  const info = platformInfo[id];
  if (icon) return <img src={icon} alt="" className="mt-0.5 size-4 rounded object-cover" />;
  return (
    <span
      className="platform-mark mt-0.5 text-[10px]"
      style={{ background: info.color, width: 16, height: 16 }}
      aria-hidden="true"
    >
      {info.mark}
    </span>
  );
}

function sameTarget(left: Target, right: Target) {
  return left.accountId === right.accountId && left.identityId === right.identityId;
}

function targetKey(target: Target) {
  return `${target.accountId}:${target.identityId}`;
}

const kindCaption = (kind: ContentKind) =>
  kind === "article" ? "文章" : kind === "moment" ? "图文" : kind === "video" ? "视频" : "音频";

function mediaLabel(kind: ContentKind) {
  if (kind === "article") return "选择封面";
  if (kind === "video") return "选择视频";
  if (kind === "audio") return "选择音频";
  return "选择图片";
}

function canPublish(kind: ContentKind, title: string, body: string, paths: string[]) {
  if (kind === "article") return Boolean(title.trim() && body.trim());
  if (kind === "video") return paths.some(isVideo);
  if (kind === "audio") return paths.some(isAudio);
  return Boolean(body.trim());
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
