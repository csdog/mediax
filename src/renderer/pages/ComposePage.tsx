import { Monitor, X, ImagePlus, FileText, Save, Users, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export function ComposePage() {
  const {
    body,
    setBody,
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
    setPage,
    silentPublish,
    setActiveBrowser,
  } = useWorkspace();
  return (
    <DocumentPage>
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
                    (t) => t.accountId === target.accountId && t.identityId === target.identityId,
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
                        if (silentPublish) setActiveBrowser(null);
                        await reload();
                        setPage("history");
                        setNotice("任务已创建，将依次发布。需要人工处理时请打开对应账号标签页。");
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
    </DocumentPage>
  );
}
