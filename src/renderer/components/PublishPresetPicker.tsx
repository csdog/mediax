import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountInfo, ContentKind, Target } from "../../shared/models";
import { resolvePresetTargets, type PublishPreset } from "../../shared/publishPresets";
import { usePublishSettings } from "@/hooks/usePublishSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const queryKey = ["desktop", "publish-presets"] as const;

export function PublishPresetPicker({
  contentKind,
  accounts,
  targets,
  onApply,
  busy,
}: {
  contentKind: ContentKind;
  accounts: AccountInfo[];
  targets: Target[];
  onApply: (targets: Target[]) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const client = useQueryClient();
  const { publishSettings, publishSettingsReady, applyPublishSettings } = usePublishSettings();
  const presets = useQuery({
    queryKey,
    queryFn: () => window.desktop.publishPresets(),
    enabled: open,
  });
  const operation = useMutation({
    mutationFn: async (
      action:
        | { type: "save" }
        | { type: "delete"; id: string }
        | { type: "apply"; preset: PublishPreset },
    ) => {
      if (action.type === "save") {
        await window.desktop.createPublishPreset({
          name,
          contentKind,
          targets,
          settings: publishSettings,
        });
        await client.invalidateQueries({ queryKey });
        setName("");
        toast.success("发布方案已保存");
      } else if (action.type === "delete") {
        const next = await window.desktop.deletePublishPreset(action.id);
        client.setQueryData(queryKey, next);
        toast.success("发布方案已删除");
      } else {
        const resolved = resolvePresetTargets(action.preset, accounts);
        if (resolved.length !== action.preset.targets.length)
          throw new Error(
            "方案中的部分账号或发布身份已失效，请到账号管理刷新，或删除后重新保存方案",
          );
        await applyPublishSettings(action.preset.settings);
        onApply(resolved);
        setOpen(false);
        toast.success(`已应用方案「${action.preset.name}」`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "操作失败，请重试"),
  });
  const disabled = busy || operation.isPending;
  const saved = (presets.data ?? []).filter((preset) => preset.contentKind === contentKind);
  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => setOpen(true)}>
        <Bookmark />
        发布方案
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!operation.isPending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布方案</DialogTitle>
            <DialogDescription>
              按内容类型保存账号、发布身份及静默、并发、限速设置。应用方案不会修改标题、正文、素材或定时时间。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="已保存的发布方案">
            {presets.isPending ? <p className="text-muted-foreground">正在读取方案…</p> : null}
            {presets.isError ? (
              <Button variant="outline" onClick={() => void presets.refetch()}>
                读取失败，重试
              </Button>
            ) : null}
            {presets.isSuccess && !saved.length ? (
              <p className="text-muted-foreground">当前内容类型还没有发布方案。</p>
            ) : null}
            {saved.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {preset.targets.length} 个发布身份 ·{" "}
                    {preset.settings.silent ? "静默发布" : "显示发布窗口"} · 并发{" "}
                    {preset.settings.concurrency} ·{" "}
                    {preset.settings.bandwidthLimitKbps
                      ? `${preset.settings.bandwidthLimitKbps} Kbps`
                      : "不限速"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={disabled}
                  aria-label={`应用方案 ${preset.name}`}
                  onClick={() => operation.mutate({ type: "apply", preset })}
                >
                  应用
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`删除方案 ${preset.name}`}
                  onClick={() => operation.mutate({ type: "delete", id: preset.id })}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <form
            className="space-y-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !disabled &&
                publishSettingsReady &&
                presets.isSuccess &&
                targets.length &&
                name.trim()
              )
                operation.mutate({ type: "save" });
            }}
          >
            <Label htmlFor="publish-preset-name">方案名称</Label>
            <Input
              id="publish-preset-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：工作账号日常发布"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              保存当前选择的 {targets.length} 个发布身份及发布设置。
            </p>
            <Button
              type="submit"
              disabled={
                disabled ||
                !targets.length ||
                !name.trim() ||
                !publishSettingsReady ||
                !presets.isSuccess
              }
            >
              保存当前配置
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
