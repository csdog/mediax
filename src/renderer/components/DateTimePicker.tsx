import { useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Temporal } from "temporal-polyfill";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import { systemTimeZone } from "../../shared/timezones";

type DateTimePickerProps = {
  value: Date;
  onChange: (next: Date) => void;
  min?: Date;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Wall-clock timezone for display / editing. Defaults to the host timezone. */
  timeZone?: string;
  size?: "default" | "lg";
};

const HOUR_ITEMS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: pad(hour),
}));

const MINUTE_ITEMS = Array.from({ length: 60 }, (_, minute) => ({
  value: String(minute),
  label: pad(minute),
}));

export function DateTimePicker({
  value,
  onChange,
  min,
  id,
  disabled,
  className,
  timeZone = systemTimeZone(),
  size = "default",
}: DateTimePickerProps) {
  const large = size === "lg";
  const [open, setOpen] = useState(false);
  const wall = wallParts(value, timeZone);
  const selectedDay = new Date(wall.year, wall.month - 1, wall.day);

  const { startMonth, endMonth } = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const minWall = min ? wallParts(min, timeZone) : null;
    return {
      startMonth: new Date(minWall?.year ?? nowYear - 1, minWall ? minWall.month - 1 : 0),
      endMonth: new Date(nowYear + 3, 11),
    };
  }, [min, timeZone]);

  const commitWall = (next: Partial<typeof wall>) => {
    onChange(
      fromWallTime(
        {
          year: next.year ?? wall.year,
          month: next.month ?? wall.month,
          day: next.day ?? wall.day,
          hour: next.hour ?? wall.hour,
          minute: next.minute ?? wall.minute,
        },
        timeZone,
      ),
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center", large ? "gap-3.5" : "gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              size={large ? "lg" : "default"}
              disabled={disabled}
              className={cn(
                "justify-start font-normal",
                large ? "h-11 min-w-56 px-3.5 text-base" : "min-w-48",
              )}
            >
              <CalendarIcon data-icon="inline-start" className={large ? "size-6" : undefined} />
              {format(selectedDay, "yyyy年M月d日 EEEE", { locale: zhCN })}
            </Button>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={zhCN}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={selectedDay}
            selected={selectedDay}
            className={
              large
                ? "p-3 text-base [--cell-size:--spacing(11)] [&_.cn-calendar-caption]:text-base [&_.cn-calendar-caption-label]:text-base"
                : undefined
            }
            onSelect={(day) => {
              if (!day) return;
              commitWall({
                year: day.getFullYear(),
                month: day.getMonth() + 1,
                day: day.getDate(),
              });
              setOpen(false);
            }}
            disabled={min ? { before: startOfZoneDay(min, timeZone) } : undefined}
          />
        </PopoverContent>
      </Popover>

      <Select
        items={HOUR_ITEMS}
        value={String(wall.hour)}
        disabled={disabled}
        onValueChange={(next) => {
          if (next == null) return;
          commitWall({ hour: Number(next) });
        }}
      >
        <SelectTrigger
          aria-label="小时"
          className={cn("tabular-nums", large ? "h-14 w-24 px-3.5 text-lg" : "w-[4.5rem]")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className={cn("min-w-24", large ? "max-h-80 text-lg" : "max-h-64")}
        >
          {HOUR_ITEMS.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className={large ? "py-2 text-lg" : undefined}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span
        className={cn("text-muted-foreground", large ? "text-2xl font-medium" : undefined)}
        aria-hidden
      >
        :
      </span>

      <Select
        items={MINUTE_ITEMS}
        value={String(wall.minute)}
        disabled={disabled}
        onValueChange={(next) => {
          if (next == null) return;
          commitWall({ minute: Number(next) });
        }}
      >
        <SelectTrigger
          aria-label="分钟"
          className={cn("tabular-nums", large ? "h-14 w-24 px-3.5 text-lg" : "w-[4.5rem]")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className={cn("min-w-24", large ? "max-h-80 text-lg" : "max-h-64")}
        >
          {MINUTE_ITEMS.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className={large ? "py-2 text-lg" : undefined}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function wallParts(date: Date, timeZone: string) {
  const zdt = Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone);
  return {
    year: zdt.year,
    month: zdt.month,
    day: zdt.day,
    hour: zdt.hour,
    minute: zdt.minute,
  };
}

function fromWallTime(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
) {
  const zdt = Temporal.ZonedDateTime.from({
    timeZone,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: 0,
    millisecond: 0,
  });
  return new Date(zdt.epochMilliseconds);
}

function startOfZoneDay(date: Date, timeZone: string) {
  const wall = wallParts(date, timeZone);
  return new Date(wall.year, wall.month - 1, wall.day);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
