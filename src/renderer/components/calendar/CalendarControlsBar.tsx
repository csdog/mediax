import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Temporal } from "temporal-polyfill";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CALENDAR_TIMEZONES, SYSTEM_TIMEZONE, systemTimeZone } from "../../../shared/timezones";

export type CalendarDisplay = "day" | "week" | "month" | "list";

type CalendarControlsBarProps = {
  display: CalendarDisplay;
  rangeStart: Date;
  rangeEnd: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onDisplayChange: (display: CalendarDisplay) => void;
  onAddSchedule?: () => void;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
};

export function CalendarControlsBar({
  display,
  rangeStart,
  rangeEnd,
  onPrevious,
  onNext,
  onToday,
  onDisplayChange,
  onAddSchedule,
  timezone = SYSTEM_TIMEZONE,
  onTimezoneChange,
}: CalendarControlsBarProps) {
  const isList = display === "list";
  const timezoneItems = CALENDAR_TIMEZONES.map((item) => ({
    value: item.value,
    label: item.value === SYSTEM_TIMEZONE ? `${item.label} (${systemTimeZone()})` : item.label,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 select-none">
      <div className="flex h-10 items-center overflow-hidden rounded-lg border bg-muted/40">
        <button
          type="button"
          aria-label="上一页"
          onClick={onPrevious}
          className="flex h-full items-center justify-center bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <div className="flex h-full min-w-48 items-center justify-center border-x bg-background px-3 text-sm">
          {displayText(display, rangeStart, rangeEnd)}
        </div>
        <button
          type="button"
          aria-label="下一页"
          onClick={onNext}
          className="flex h-full items-center justify-center bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <Button type="button" variant="outline" className="h-10 bg-background" onClick={onToday}>
        今天
      </Button>

      {onAddSchedule ? (
        <Button type="button" className="h-10" onClick={onAddSchedule}>
          <PlusIcon className="size-4" />
          添加排期
        </Button>
      ) : null}

      <div className="flex-1" />

      {onTimezoneChange ? (
        <Select
          items={timezoneItems}
          value={timezone}
          onValueChange={(value) => {
            if (value) onTimezoneChange(value);
          }}
        >
          <SelectTrigger aria-label="日历时区" className="h-10 w-48 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezoneItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {!isList ? (
        <div className="flex rounded-lg border bg-background p-1 text-sm font-medium">
          {(
            [
              ["day", "日"],
              ["week", "周"],
              ["month", "月"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onDisplayChange(id)}
              className={cn(
                "min-w-[4.5rem] rounded-md px-3 py-1.5 transition-colors",
                display === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex rounded-lg border bg-background p-1">
        <button
          type="button"
          aria-label="日历视图"
          onClick={() => onDisplayChange(display === "list" ? "week" : display)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            !isList
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarDaysIcon className="size-4" />
        </button>
        <button
          type="button"
          aria-label="列表视图"
          onClick={() => onDisplayChange("list")}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            isList
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function displayToViewName(display: CalendarDisplay) {
  if (display === "day") return "day";
  if (display === "month") return "month-grid";
  if (display === "list") return "list";
  return "week";
}

export function viewNameToDisplay(view: string): CalendarDisplay {
  if (view === "day") return "day";
  if (view === "month-grid" || view === "month-agenda") return "month";
  if (view === "list" || view === "week-agenda") return "list";
  return "week";
}

export function shiftPlainDate(
  date: Temporal.PlainDate,
  display: CalendarDisplay,
  direction: -1 | 1,
) {
  if (display === "day") return date.add({ days: direction });
  if (display === "month") return date.add({ months: direction });
  // week + list both step by week
  return date.add({ weeks: direction });
}

function displayText(display: CalendarDisplay, start: Date, end: Date) {
  const thisYear = new Date().getFullYear();
  if (display === "day") {
    const dayFmt = start.getFullYear() === thisYear ? "EEEE（M月d日）" : "EEEE（yyyy年M月d日）";
    return format(start, dayFmt, { locale: zhCN });
  }
  if (display === "month") {
    return format(start, "yyyy年M月", { locale: zhCN });
  }
  const startFmt = start.getFullYear() === thisYear ? "M月d日" : "yyyy年M月d日";
  const endFmt = end.getFullYear() === thisYear ? "M月d日" : "yyyy年M月d日";
  return `${format(start, startFmt, { locale: zhCN })} – ${format(end, endFmt, { locale: zhCN })}`;
}
