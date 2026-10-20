import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { toast } from "sonner";
import {
  X,
  ImagePlus,
  FileText,
  Save,
  Send,
  Plus,
  FolderOpen,
  CalendarClock,
  Layers,
  RotateCcw,
  Users,
} from "lucide-react";
import { applyLocalFiles, pathsFromDataTransfer } from "@/lib/importLocalFiles";
import { publishKindMeta } from "@/lib/publishKindMeta";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { isAudio, isImage, isVideo, supportedKinds } from "../../shared/content";
import type { AccountInfo, ContentKind, ImageAsset, PlatformId, Target } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";
import {
  groupPublishBatches,
  platformHasCustomContent,
  type PlatformContent,
} from "../../shared/publishBatches";
import { AccountIdentity, PlatformGlyph } from "@/components/AccountIdentity";
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

type SettingsScope = "batch" | PlatformId;

export function ComposePage() {
  const {
    body,
    setBody,
    contentKind,
    title,
    setTitle,
    images,
    setImages,
    busy,
    run,
    accounts,
    selectedTargets,
    setSelectedTargets,
    publishDialogOpen,
    setPublishDialogOpen,
    setFocusedTask,
    reload,
    setPage,
    silentPublish,
    setActiveBrowser,
    activeBrowser,
    isComposeTab,
    closeBrowserTab,
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
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("batch");
  const [platformContent, setPlatformContent] = useState<
    Partial<Record<PlatformId, PlatformContent>>
  >({});
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
      if (result.notice) toast(result.notice);
    });
  };
  const paths = images.map((image) => image.path);
  const selectedPlatforms = useMemo(() => {
    const ids: PlatformId[] = [];
    for (const target of selectedTargets) {
      const account = accounts.find((item) => item.id === target.accountId);
      if (account && !ids.includes(account.platform)) ids.push(account.platform);
    }
    return ids;
  }, [accounts, selectedTargets]);
  useEffect(() => {
    if (settingsScope !== "batch" && !selectedPlatforms.includes(settingsScope))
      setSettingsScope("batch");
  }, [selectedPlatforms, settingsScope]);
  useEffect(() => {
    setPlatformContent((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const platform of Object.keys(next) as PlatformId[]) {
        if (!selectedPlatforms.includes(platform)) {
          delete next[platform];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPlatforms]);
  const editingTitle =
    settingsScope === "batch" ? title : (platformContent[settingsScope]?.title ?? title);
  const editingBody =
    settingsScope === "batch" ? body : (platformContent[settingsScope]?.body ?? body);
  const scopeCustomized =
    settingsScope !== "batch" &&
    platformHasCustomContent(settingsScope, { title, body }, platformContent);
  const setEditingTitle = (value: string) => {
    if (settingsScope === "batch") {
      setTitle(value);
      return;
    }
    const platform = settingsScope;
    setPlatformContent((prev) => ({
      ...prev,
      [platform]: { title: value, body: prev[platform]?.body ?? body },
    }));
  };
  const setEditingBody = (value: string) => {
    if (settingsScope === "batch") {
      setBody(value);
      return;
    }
    const platform = settingsScope;
    setPlatformContent((prev) => ({
      ...prev,
      [platform]: { title: prev[platform]?.title ?? title, body: value },
    }));
  };
  const publishBatches = useMemo(
    () =>
      selectedTargets.length
        ? groupPublishBatches({
            kind: contentKind,
            title,
            body,
            targets: selectedTargets,
            accounts,
            platformContent,
          })
        : [],
    [accounts, body, contentKind, platformContent, selectedTargets, title],
  );
  const ready =
    selectedTargets.length > 0
      ? publishBatches.every((batch) =>
          canPublish(contentKind, batch.title ?? "", batch.body, paths),
        )
      : canPublish(contentKind, title, body, paths);
  const customizedCount = selectedPlatforms.filter((platform) =>
    platformHasCustomContent(platform, { title, body }, platformContent),
  ).length;
  const signature = [
    contentKind,
    title,
    body,
    JSON.stringify(platformContent),
    paths.join("\n"),
    selectedTargets
      .map((target) => `${target.accountId}:${target.identityId}`)
      .sort()
      .join("\n"),
  ].join("\0");
  const synced = syncedSignature === signature && selectedTargets.length > 0 && ready;
  const eligible = accounts.filter(
    (account) => supportedKinds(account.platform).includes(contentKind) && account.targets.length,
  );
  const kindMeta = publishKindMeta[contentKind];
  const KindIcon = kindMeta.icon;
  const needsMediaDrop =
    (contentKind === "video" || contentKind === "audio") &&
    !paths.some((path) => (contentKind === "video" ? isVideo(path) : isAudio(path)));
  const chooseMedia = () =>
    void run(async () => {
      const added = await window.desktop.chooseImages(contentKind);
      setImages((old) => [
        ...old,
        ...added.filter((item) => !old.some((image) => image.path === item.path)),
      ]);
    });
  const coverImage = images.find((item) => isImage(item.path)) ?? null;
  const setCoverPath = (path: string) => {
    setImages((old) => {
      const index = old.findIndex((item) => item.path === path);
      if (index < 0) return old;
      const next = [...old];
      const [item] = next.splice(index, 1);
      if (contentKind === "video" || contentKind === "audio") {
        const mediaIndex = next.findIndex((entry) => isVideo(entry.path) || isAudio(entry.path));
        next.splice(mediaIndex + 1, 0, item);
        return next.filter((entry, i, list) => list.findIndex((x) => x.path === entry.path) === i);
      }
      next.unshift(item);
      return next;
    });
  };
  const chooseCover = () =>
    void run(async () => {
      const added = await window.desktop.chooseImages(
        contentKind === "article" ? "article" : contentKind === "video" ? "video" : "moment",
      );
      const cover = added.find((item) => isImage(item.path));
      if (!cover) return;
      setImages((old) => {
        if (contentKind === "article") return [cover];
        const withoutCover = old.filter((item) => item.path !== cover.path);
        if (contentKind === "video" || contentKind === "audio") {
          const media = withoutCover.filter((item) => isVideo(item.path) || isAudio(item.path));
          const others = withoutCover.filter((item) => !isVideo(item.path) && !isAudio(item.path));
          return [...media, cover, ...others];
        }
        return [cover, ...withoutCover];
      });
    });
  const openPublishConfirm = () => {
    if (!ready || !selectedTargets.length) return;
    setSyncedSignature(signature);
    setPublishDialogOpen(true);
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
            <span className="text-sm text-muted-foreground">共 {selectedTargets.length} 个</span>
          </div>
          <Button variant="outline" className="mt-5 w-full" onClick={openPicker}>
            <Plus />
            新增账号
          </Button>
          <nav
            className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto"
            aria-label="内容设置范围"
          >
            <button
              type="button"
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border-0 bg-transparent px-3.5 py-3 text-left text-foreground hover:bg-[color-mix(in_oklab,var(--muted)_55%,transparent)]",
                settingsScope === "batch" &&
                  "bg-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
              )}
              onClick={() => setSettingsScope("batch")}
            >
              <span
                className="mt-0 grid size-8 shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_oklab,var(--muted)_80%,transparent)] text-muted-foreground"
                aria-hidden
              >
                <Layers className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[15px] font-medium">快速填写</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  同步到未单独设置的平台
                </span>
              </span>
            </button>
            {selectedTargets.map((target) => {
              const account = accounts.find((item) => item.id === target.accountId);
              if (!account) return null;
              const active = settingsScope === account.platform;
              const customized = platformHasCustomContent(
                account.platform,
                { title, body },
                platformContent,
              );
              const pending = synced && selectedTargets.some((item) => sameTarget(item, target));
              const identityDetail = [
                target.name,
                target.kind === "profile" ? "个人主页" : "公共主页",
                pending ? "待发布" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={targetKey(target)}
                  className={cn(
                    "group relative flex items-stretch gap-0.5 rounded-xl",
                    active && "bg-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full min-w-0 cursor-pointer items-center rounded-xl border-0 bg-transparent py-3 pr-8 pl-3.5 text-left text-foreground hover:bg-[color-mix(in_oklab,var(--muted)_55%,transparent)]"
                    onClick={() => setSettingsScope(account.platform)}
                  >
                    <AccountIdentity
                      name={account.name}
                      platform={account.platform}
                      avatar={account.avatar}
                      detail={identityDetail}
                      titleAdornment={
                        customized ? (
                          <span
                            className="publish-settings-dot shrink-0"
                            title="已单独设置"
                            aria-label="已单独设置"
                          />
                        ) : null
                      }
                    />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1.5 right-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`移除 ${target.name}`}
                    disabled={busy}
                    onClick={() => toggleTarget(target, false)}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            {!selectedTargets.length && (
              <Empty className="border-0 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>{eligible.length ? "尚未选择发布身份" : "暂无可发布身份"}</EmptyTitle>
                  <EmptyDescription>
                    {eligible.length
                      ? "点击上方「新增账号」勾选本次要发布的身份。"
                      : "在账号管理中检查登录状态，识别可发布身份。"}
                  </EmptyDescription>
                </EmptyHeader>
                {!eligible.length ? (
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        setActiveBrowser(null);
                        setPage("accounts");
                      }}
                    >
                      <Users />
                      账号管理
                    </Button>
                  </EmptyContent>
                ) : null}
              </Empty>
            )}
          </nav>
        </aside>
        <section className="draft-pane" aria-label="内容编辑">
          <div className="publish-toolbar">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: kindMeta.gradient }}
                aria-hidden
              >
                <KindIcon className="size-7" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h2>{kindMeta.title}</h2>
                <p className="publish-toolbar-hint">{kindMeta.hint}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await window.desktop.saveDraft(body, images, contentKind, title);
                    toast.success("草稿已保存到本机");
                  })
                }
              >
                <Save />
                保存草稿
              </Button>
              <Button
                disabled={busy || !ready || !selectedTargets.length}
                onClick={openPublishConfirm}
              >
                <Send />
                一键发布
              </Button>
            </div>
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
          <div
            className={`composer-dock ${dragging ? "composer-drop-active" : ""}`}
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
                松开以导入素材或 Markdown
              </div>
            ) : null}
            {settingsScope !== "batch" ? (
              <div className="mb-2.5 flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {selectedTargets.map((target) => {
                    const account = accounts.find((item) => item.id === target.accountId);
                    if (!account || account.platform !== settingsScope) return null;
                    const pending =
                      synced && selectedTargets.some((item) => sameTarget(item, target));
                    const identityDetail = [
                      target.name,
                      target.kind === "profile" ? "个人主页" : "公共主页",
                      pending ? "待发布" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <AccountIdentity
                        key={targetKey(target)}
                        name={account.name}
                        platform={account.platform}
                        avatar={account.avatar}
                        detail={identityDetail}
                        titleAdornment={
                          scopeCustomized ? (
                            <span
                              className="publish-settings-dot shrink-0"
                              title="已单独设置"
                              aria-label="已单独设置"
                            />
                          ) : null
                        }
                      />
                    );
                  })}
                </div>
                {scopeCustomized ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs text-muted-foreground"
                    disabled={busy}
                    onClick={() => {
                      const platform = settingsScope as PlatformId;
                      setPlatformContent((prev) => {
                        const next = { ...prev };
                        delete next[platform];
                        return next;
                      });
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                    恢复快速填写
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="composer-form">
              {contentKind === "video" || contentKind === "audio" ? (
                <section className="composer-section">
                  <div className="composer-section-head">
                    <Label>{contentKind === "video" ? "视频" : "音频"}</Label>
                  </div>
                  {needsMediaDrop ? (
                    <button
                      type="button"
                      className="mediax-media-drop"
                      disabled={busy}
                      onClick={chooseMedia}
                      aria-label={kindMeta.mediaAction}
                    >
                      <span
                        className="flex size-16 items-center justify-center rounded-2xl text-white"
                        style={{ background: kindMeta.gradient }}
                        aria-hidden
                      >
                        <KindIcon className="size-8" />
                      </span>
                      <span className="mt-4 text-base font-medium">{kindMeta.mediaAction}</span>
                      <span className="mt-1.5 text-sm text-muted-foreground">
                        点击选择，或拖拽文件到此处
                      </span>
                    </button>
                  ) : (
                    images
                      .filter((image) =>
                        contentKind === "video" ? isVideo(image.path) : isAudio(image.path),
                      )
                      .map((media) => (
                        <div className="composer-media-chip" key={media.path}>
                          <span className="truncate text-sm">{media.name}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`移除 ${media.name}`}
                            onClick={() =>
                              setImages(images.filter((item) => item.path !== media.path))
                            }
                          >
                            <X />
                          </Button>
                        </div>
                      ))
                  )}
                </section>
              ) : null}

              {contentKind === "moment" ? (
                <section className="composer-section">
                  <div className="composer-section-head">
                    <Label>图片</Label>
                    <div className="flex items-center gap-2">
                      {images.length ? (
                        <span className="text-sm text-muted-foreground">
                          已上传 {images.length} 张图片，将同步到所选账号
                        </span>
                      ) : null}
                      <Button type="button" disabled={busy} onClick={chooseMedia}>
                        <ImagePlus className="size-4" />
                        添加图片
                      </Button>
                    </div>
                  </div>
                  <div className="composer-images">
                    {images.map((image) => {
                      const isCover = coverImage?.path === image.path;
                      return (
                        <div className="composer-image-tile" key={image.path}>
                          {image.preview ? (
                            <img
                              className="composer-thumb border object-cover"
                              src={image.preview}
                              alt={image.name}
                            />
                          ) : (
                            <div
                              className="composer-thumb flex items-center justify-center border text-xs text-muted-foreground"
                              title={image.name}
                            >
                              媒体
                            </div>
                          )}
                          {isCover ? (
                            <span className="composer-cover-badge">封面</span>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="composer-set-cover"
                              disabled={busy}
                              onClick={() => setCoverPath(image.path)}
                            >
                              设为封面
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="icon-xs"
                            aria-label={`移除 ${image.name}`}
                            onClick={() =>
                              setImages(images.filter((item) => item.path !== image.path))
                            }
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
                      );
                    })}
                    <button
                      type="button"
                      className="composer-image-add"
                      disabled={busy}
                      onClick={chooseMedia}
                      aria-label="添加图片"
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                </section>
              ) : null}

              {contentKind === "moment" || contentKind === "video" ? (
                <CoverSection
                  coverImage={coverImage}
                  busy={busy}
                  hint={
                    contentKind === "moment"
                      ? "如果不设置，平台通常默认使用第一张图片作为封面"
                      : "不设置时，平台通常使用视频首帧作为封面"
                  }
                  onChoose={chooseCover}
                />
              ) : null}

              <section className="composer-section">
                <div className="composer-section-head">
                  <Label htmlFor="post-title">标题</Label>
                  <span className="text-sm text-muted-foreground">{editingTitle.length}/80</span>
                </div>
                <Input
                  id="post-title"
                  value={editingTitle}
                  maxLength={80}
                  placeholder="请输入标题..."
                  onChange={(event) => setEditingTitle(event.target.value)}
                />
                {contentKind === "moment" ? (
                  <p className="composer-section-hint">部分平台不支持标题，发布时会自动忽略</p>
                ) : null}
              </section>

              <section className="composer-section">
                <div className="composer-section-head">
                  <Label htmlFor="post-body">{contentKind === "article" ? "正文" : "描述"}</Label>
                  <div className="flex items-center gap-2">
                    {contentKind === "article" || contentKind === "moment" ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const text = await window.desktop.importMarkdown();
                            if (text !== null) {
                              if (settingsScope === "batch") setBody(text);
                              else setEditingBody(text);
                            }
                          })
                        }
                      >
                        <FileText className="size-4" />
                        导入 Markdown
                      </Button>
                    ) : null}
                    <span className="text-sm text-muted-foreground">{editingBody.length} 字符</span>
                  </div>
                </div>
                <Textarea
                  id="post-body"
                  className="composer-body-input"
                  aria-label={contentKind === "article" ? "发布正文" : undefined}
                  placeholder={
                    contentKind === "video" || contentKind === "audio"
                      ? "填写简介…"
                      : contentKind === "moment"
                        ? "请输入描述..."
                        : "写下要分享的内容…"
                  }
                  value={editingBody}
                  onChange={(event) => setEditingBody(event.target.value)}
                />
              </section>

              {contentKind === "article" ? (
                <CoverSection
                  coverImage={coverImage}
                  busy={busy}
                  hint="上传一张封面图；不设置也可发布"
                  onChoose={chooseCover}
                />
              ) : null}
            </div>
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
                {customizedCount
                  ? `已有 ${customizedCount} 个平台单独设置，将按内容分组创建 ${publishBatches.length} 个任务。`
                  : "同一份内容会发到所选账号。"}
                定时发布需保持 MediaX 在运行，到点后自动入队。
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
            <ul className="flex flex-col gap-3">
              {selectedTargets.map((target) => {
                const account = accounts.find((item) => item.id === target.accountId);
                if (!account) {
                  return (
                    <li key={`${target.accountId}:${target.identityId}`} className="text-sm">
                      {target.name}
                    </li>
                  );
                }
                return (
                  <li key={`${target.accountId}:${target.identityId}`}>
                    <AccountIdentity
                      name={account.name}
                      platform={account.platform}
                      avatar={account.avatar}
                      detail={`${target.name} · ${target.kind === "profile" ? "个人主页" : "公共主页"}`}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="max-h-60 space-y-3 overflow-auto">
              {publishBatches.map((batch, index) => (
                <div key={index} className="rounded-lg border p-3 text-sm">
                  {batch.title ? <p className="mb-1 font-medium">{batch.title}</p> : null}
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {batch.body || "无正文"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {batch.targets.length} 个账号
                    {publishBatches.length > 1
                      ? ` · 第 ${index + 1}/${publishBatches.length} 组`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {images.length} 个素材 · {kindCaption(contentKind)}
              {publishBatches.length > 1 ? ` · ${publishBatches.length} 组内容` : ""}
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
                    const taskId = await window.desktop.publishBatches(
                      contentKind,
                      paths,
                      publishBatches,
                      scheduledAt,
                    );
                    setPublishDialogOpen(false);
                    setFocusedTask(taskId);
                    if (isComposeTab && activeBrowser) await closeBrowserTab(activeBrowser);
                    else setActiveBrowser(null);
                    if (silentPublish) setActiveBrowser(null);
                    await reload();
                    setPage(publishMode === "schedule" ? "calendar" : "history");
                    toast.success(
                      publishMode === "schedule"
                        ? "已加入排期；保持应用运行，到点后将自动发布。"
                        : publishBatches.length > 1
                          ? `已创建 ${publishBatches.length} 组任务，将按并行设置发布。`
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
          <DialogDescription>勾选本次要发布的账号（仅显示支持当前类型的平台）。</DialogDescription>
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
                  <PlatformGlyph id={id} />
                  {platformInfo[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm whitespace-nowrap ">
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
  const identityDetail = [
    target.name,
    target.kind === "profile" ? "个人主页" : "公共主页",
    pending ? "待发布" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        className="mt-3"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <AccountIdentity
        name={account.name}
        platform={account.platform}
        avatar={account.avatar}
        detail={identityDetail}
      />
    </label>
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

function CoverSection({
  coverImage,
  busy,
  hint,
  onChoose,
}: {
  coverImage: ImageAsset | null;
  busy: boolean;
  hint: string;
  onChoose: () => void;
}) {
  return (
    <section className="composer-section">
      <div className="composer-section-head">
        <Label>封面</Label>
        <Button type="button" variant="outline" disabled={busy} onClick={onChoose}>
          <ImagePlus className="size-4" />
          {coverImage ? "更换封面" : "上传封面"}
        </Button>
      </div>
      {coverImage ? (
        <div className="composer-cover-preview">
          {coverImage.preview ? (
            <img src={coverImage.preview} alt={`${coverImage.name} 封面`} />
          ) : (
            <span>封面</span>
          )}
        </div>
      ) : (
        <button type="button" className="composer-cover-empty" disabled={busy} onClick={onChoose}>
          <ImagePlus className="size-5" />
          <span>选择封面图</span>
        </button>
      )}
      <p className="composer-section-hint">{hint}</p>
    </section>
  );
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
