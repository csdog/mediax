import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { platformIcons } from "@/assets/platformIcons";
import { publishKindMeta } from "@/lib/publishKindMeta";
import { supportedKinds } from "../../../shared/content";
import { platforms, type ContentKind, type PlatformId } from "../../../shared/models";
import { platformInfo } from "../../../shared/platforms";

const PREVIEW_COUNT = 5;

const optionOrder: ContentKind[] = ["video", "moment", "article", "audio"];

function platformsForKind(kind: ContentKind): PlatformId[] {
  return platforms.filter((id) => supportedKinds(id).includes(kind));
}

export function PublishKindPicker({ onSelect }: { onSelect: (kind: ContentKind) => void }) {
  const [hovered, setHovered] = useState<ContentKind | null>(null);
  const platformMap = useMemo(() => {
    const map = {} as Record<ContentKind, PlatformId[]>;
    for (const kind of optionOrder) map[kind] = platformsForKind(kind);
    return map;
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {optionOrder.map((kind) => {
        const option = publishKindMeta[kind];
        const Icon = option.icon;
        const list = platformMap[kind];
        const preview = list.slice(0, PREVIEW_COUNT);
        const overflow = Math.max(0, list.length - preview.length);
        const selected = hovered === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-label={option.action}
            onMouseEnter={() => setHovered(kind)}
            onMouseLeave={() => setHovered((current) => (current === kind ? null : current))}
            onFocus={() => setHovered(kind)}
            onBlur={() => setHovered((current) => (current === kind ? null : current))}
            className={`flex flex-col items-center gap-3 rounded-2xl border bg-card px-3 py-5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? "border-violet-300 shadow-[0_0_0_3px_rgba(167,139,250,0.22)]"
                : "border-border/70 hover:border-violet-200 hover:bg-muted/30"
            }`}
            onClick={() => onSelect(kind)}
          >
            <span
              className="flex size-14 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: option.gradient }}
              aria-hidden
            >
              <Icon className="size-7" strokeWidth={1.75} />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold tracking-tight">{option.title}</span>
              <span className="block text-xs text-muted-foreground">支持平台 ({list.length})</span>
            </span>
            <PlatformPreview platforms={preview} overflow={overflow} all={list} stopPropagation />
          </button>
        );
      })}
    </div>
  );
}

export function PublishKindDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (kind: ContentKind) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>选择发布类型</DialogTitle>
          <DialogDescription className="sr-only">
            选择视频、图文、文章或音频后进入对应编辑页
          </DialogDescription>
        </DialogHeader>
        <PublishKindPicker
          onSelect={(kind) => {
            onSelect(kind);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PlatformPreview({
  platforms: ids,
  overflow,
  all,
  stopPropagation,
}: {
  platforms: PlatformId[];
  overflow: number;
  all: PlatformId[];
  stopPropagation?: boolean;
}) {
  if (!ids.length) {
    return <span className="h-7 text-xs text-muted-foreground">暂无适配平台</span>;
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={80}
        render={
          <span
            className="flex items-center justify-center"
            onClick={(event) => {
              if (!stopPropagation) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              if (!stopPropagation) return;
              event.stopPropagation();
            }}
          >
            <span className="flex items-center">
              {ids.map((id, index) => {
                const icon = platformIcons[id];
                const label = platformInfo[id]?.label ?? id;
                return (
                  <span
                    key={id}
                    className="relative flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted"
                    style={{ marginLeft: index === 0 ? 0 : -6, zIndex: ids.length - index }}
                    title={label}
                  >
                    {icon ? (
                      <img src={icon} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-medium text-muted-foreground">
                        {label.slice(0, 1)}
                      </span>
                    )}
                  </span>
                );
              })}
              {overflow > 0 ? (
                <span
                  className="relative flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground"
                  style={{ marginLeft: -6, zIndex: 0 }}
                >
                  +{overflow}
                </span>
              ) : null}
            </span>
          </span>
        }
      />
      <HoverCardContent
        side="bottom"
        align="center"
        className="w-64 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-2 text-sm font-medium">全部平台</p>
        <div className="grid max-h-56 grid-cols-2 gap-1 overflow-auto">
          {all.map((id) => {
            const icon = platformIcons[id];
            const label = platformInfo[id]?.label ?? id;
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-muted"
              >
                <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {icon ? (
                    <img src={icon} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[9px]">{label.slice(0, 1)}</span>
                  )}
                </span>
                <span className="truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
