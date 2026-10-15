import { DateTimePicker } from "@/components/DateTimePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import { useMemo } from "react";

export type AnchorPoint = { x: number; y: number };

type AddSchedulePopoverProps = {
  open: boolean;
  value: Date;
  min: Date;
  timeZone: string;
  hasAccounts: boolean;
  /** Viewport coordinates of the grid click; `null` centers the popover (toolbar). */
  anchor: AnchorPoint | null;
  onOpenChange: (open: boolean) => void;
  onChange: (value: Date) => void;
  onConfirm: () => void;
};

/** Postiz-style create-from-calendar: popover anchored at the clicked grid cell. */
export function AddSchedulePopover({
  open,
  value,
  min,
  timeZone,
  hasAccounts,
  anchor,
  onOpenChange,
  onChange,
  onConfirm,
}: AddSchedulePopoverProps) {
  const centered = anchor == null;
  const clockLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
  const dayLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    weekday: "short",
    month: "long",
    day: "numeric",
  }).format(value);

  const virtualAnchor = useMemo(() => {
    const point = anchor ?? { x: 0, y: 0 };
    return {
      getBoundingClientRect: () =>
        DOMRect.fromRect({
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        }),
    };
  }, [anchor]);

  const popup = (
    <PopoverPrimitive.Popup
      className={cn(
        "schedule-dialog z-50 flex w-[min(34rem,calc(100vw-2rem))] origin-(--transform-origin) flex-col gap-6 p-6 text-popover-foreground outline-hidden",
        "rounded-[var(--radius-dialog)] bg-popover shadow-lg ring-1 ring-border",
        "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="schedule-dialog__brand">MediaX</p>
        <PopoverPrimitive.Title className="text-[1.75rem] font-semibold leading-none tracking-tight">
          添加排期
        </PopoverPrimitive.Title>
        <PopoverPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
          确认时间后进入创作页；到点发布需保持 MediaX 运行。
        </PopoverPrimitive.Description>
      </div>

      <div className="schedule-dialog__hero" aria-hidden>
        <p className="schedule-dialog__clock">{clockLabel}</p>
        <p className="schedule-dialog__day">{dayLabel}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="add-schedule-at" className="text-sm">
          发布时间（{timeZone}）
        </Label>
        <DateTimePicker
          id="add-schedule-at"
          value={value}
          min={min}
          timeZone={timeZone}
          size="lg"
          onChange={onChange}
        />
        <p className="text-sm text-muted-foreground">时区：{timeZone}</p>
        {!hasAccounts ? (
          <p className="text-sm text-destructive">请先在账号管理中添加可发布账号。</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!hasAccounts || value.getTime() < min.getTime()}
          onClick={onConfirm}
        >
          开始创作
        </Button>
      </div>
    </PopoverPrimitive.Popup>
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Backdrop
          data-slot="popover-overlay"
          className={cn(
            "fixed inset-0 z-40 bg-black/10 duration-150 supports-backdrop-filter:backdrop-blur-xs",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          )}
          onClick={() => onOpenChange(false)}
        />
        {centered ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="schedule-dialog__glow" aria-hidden />
            <PopoverPrimitive.Positioner
              anchor={virtualAnchor}
              className="pointer-events-auto static! transform-none!"
              style={{ position: "static", transform: "none", inset: "auto" }}
            >
              {popup}
            </PopoverPrimitive.Positioner>
          </div>
        ) : (
          <PopoverPrimitive.Positioner
            anchor={virtualAnchor}
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={16}
            className="isolate z-50"
          >
            {popup}
          </PopoverPrimitive.Positioner>
        )}
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function pointerFromEvent(event?: UIEvent): AnchorPoint | null {
  if (!event) return null;
  if ("clientX" in event) {
    const mouse = event as MouseEvent;
    if (Number.isFinite(mouse.clientX) && Number.isFinite(mouse.clientY)) {
      return { x: mouse.clientX, y: mouse.clientY };
    }
  }
  const touch = (event as TouchEvent).changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return null;
}
