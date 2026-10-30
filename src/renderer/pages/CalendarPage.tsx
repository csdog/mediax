import { useWorkspace } from "@/app/WorkspaceContext";
import {
  AddSchedulePopover,
  pointerFromEvent,
  type AnchorPoint,
} from "@/components/calendar/AddSchedulePopover";
import {
  CalendarControlsBar,
  displayToViewName,
  shiftPlainDate,
  viewNameToDisplay,
  type CalendarDisplay,
} from "@/components/calendar/CalendarControlsBar";
import { attachCurrentTimeAxisLabel } from "@/components/calendar/currentTimeAxisLabel";
import { attachPastSlotPointerGuard } from "@/components/calendar/pastSlotPointer";
import {
  defaultScheduleAt,
  halfHourSlotRange,
  pastBackgroundEvents,
  scheduleFromDateTime,
  scheduleFromPlainDate,
} from "@/components/calendar/scheduleFromSlot";
import { MonthGridEventCard, TimeGridEventCard } from "@/components/calendar/TimeGridEventCard";
import type { CalendarPublisher } from "@/components/calendar/PlatformAvatarGroup";
import { WeekGridDate } from "@/components/calendar/WeekGridDate";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useDesktopBehavior } from "@/hooks/useDesktopBehavior";
import {
  createViewDay,
  createViewList,
  createViewMonthGrid,
  createViewWeek,
  type CalendarEventExternal,
} from "@schedule-x/calendar";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { ScheduleXCalendar, useCalendarApp } from "@schedule-x/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Temporal } from "temporal-polyfill";
import "temporal-polyfill/global";
import type { AccountInfo, CalendarEntry, PlatformId } from "../../shared/models";
import { resolveTimeZone, SYSTEM_TIMEZONE } from "../../shared/timezones";

/** Visual block height only; the card shows a single publish time, not a range. */
const EVENT_MINUTES = 60;

/** Must be module-scoped — ScheduleXCalendar re-renders the calendar when this identity changes. */
const calendarCustomComponents = {
  weekGridDate: WeekGridDate,
  timeGridEvent: TimeGridEventCard,
  monthGridEvent: MonthGridEventCard,
};

type RangeIso = { from: string; to: string };

export function CalendarPage() {
  const { setPage, setFocusedTask, run, busy, accounts, openComposeSchedule } = useWorkspace();
  const { settings: desktopBehavior, setSettings: setDesktopBehavior } = useDesktopBehavior();
  const queryClient = useQueryClient();
  const [reschedule, setReschedule] = useState<CalendarEntry | null>(null);
  const [scheduleAt, setScheduleAt] = useState(() => hoursFromNow(1));
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addScheduleAt, setAddScheduleAt] = useState(() => defaultScheduleAt());
  const [addScheduleAnchor, setAddScheduleAnchor] = useState<AnchorPoint | null>(null);
  const [display, setDisplay] = useState<CalendarDisplay>("week");
  const [rangeStart, setRangeStart] = useState(() => new Date());
  const [rangeEnd, setRangeEnd] = useState(() => new Date());

  const storedTimezone = desktopBehavior.calendarTimezone || SYSTEM_TIMEZONE;
  const timeZone = resolveTimeZone(storedTimezone);
  const timeZoneRef = useRef(timeZone);
  timeZoneRef.current = timeZone;

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const entriesRef = useRef(new Map<string, CalendarEntry>());
  const rangeRef = useRef<RangeIso | null>(null);
  const calendarRootRef = useRef<HTMLDivElement | null>(null);
  const openEntryRef = useRef<(entry: CalendarEntry) => void>(() => undefined);
  const openAddScheduleRef = useRef<(at: Date | null, anchor?: AnchorPoint | null) => void>(
    () => undefined,
  );

  const eventsService = useState(() => createEventsServicePlugin())[0];
  const currentTime = useState(() => createCurrentTimePlugin())[0];
  const calendarControls = useState(() => createCalendarControlsPlugin())[0];

  openEntryRef.current = (entry) => {
    if (entry.targets.every((t) => t.status === "scheduled")) {
      setReschedule(entry);
      setScheduleAt(new Date(entry.when));
      return;
    }
    setFocusedTask(entry.task.id);
    setPage("history");
  };

  openAddScheduleRef.current = (at, anchor = null) => {
    if (!at) {
      toast.info("无法排期到过去的时间");
      return;
    }
    setAddScheduleAt(at);
    setAddScheduleAnchor(anchor);
    setAddScheduleOpen(true);
    try {
      const plain = Temporal.Instant.fromEpochMilliseconds(at.getTime())
        .toZonedDateTimeISO(timeZoneRef.current)
        .toPlainDate();
      calendarControls.setDate(plain);
    } catch {
      // Controls may not be bound yet on first paint.
    }
  };

  const calendar = useCalendarApp({
    locale: "zh-CN",
    timezone: timeZone as `${string}/${string}`,
    firstDayOfWeek: 1,
    defaultView: "week",
    theme: "shadcn",
    isDark: document.documentElement.classList.contains("dark"),
    selectedDate: Temporal.Now.plainDateISO(timeZone),
    weekOptions: {
      gridHeight: 1600,
      eventWidth: 95,
      timeAxisFormatOptions: { hour: "2-digit", minute: "2-digit" },
    },
    calendars: {
      scheduled: {
        colorName: "scheduled",
        label: "已排期",
        lightColors: {
          main: "#0285ff",
          container: "#e6f3ff",
          onContainer: "#0b4f8a",
        },
        darkColors: {
          main: "#339cff",
          container: "#16324a",
          onContainer: "#d0ebff",
        },
      },
      published: {
        colorName: "published",
        label: "已创建/已发",
        lightColors: {
          main: "#5d5d5d",
          container: "#f3f3f3",
          onContainer: "#0d0d0d",
        },
        darkColors: {
          main: "#a0a0a0",
          container: "#2c2c2c",
          onContainer: "#f3f3f3",
        },
      },
    },
    views: [createViewWeek(), createViewDay(), createViewMonthGrid(), createViewList()],
    plugins: [eventsService, currentTime, calendarControls],
    callbacks: {
      async fetchEvents(range) {
        const from = new Date(range.start.epochMilliseconds).toISOString();
        const to = new Date(range.end.epochMilliseconds).toISOString();
        rangeRef.current = { from, to };
        setRangeStart(new Date(range.start.epochMilliseconds));
        setRangeEnd(new Date(range.end.epochMilliseconds));
        const entries = await window.desktop.calendar({ from, to });
        entriesRef.current = new Map(entries.map((entry) => [entry.task.id, entry]));
        return entries.map((entry) =>
          toScheduleEvent(entry, accountsRef.current, timeZoneRef.current),
        );
      },
      onEventClick(calendarEvent) {
        const entry = entriesRef.current.get(String(calendarEvent.id));
        if (entry) openEntryRef.current(entry);
      },
      onClickDateTime(dateTime, event) {
        openAddScheduleRef.current(scheduleFromDateTime(dateTime), pointerFromEvent(event));
      },
      onClickDate(date, event) {
        openAddScheduleRef.current(
          scheduleFromPlainDate(date, timeZoneRef.current),
          pointerFromEvent(event),
        );
      },
      onRangeUpdate(range) {
        setRangeStart(new Date(range.start.epochMilliseconds));
        setRangeEnd(new Date(range.end.epochMilliseconds));
        try {
          setDisplay(viewNameToDisplay(calendarControls.getView()));
        } catch {
          // Controls plugin may fire before $app is bound.
        }
      },
    },
  });

  useEffect(() => {
    if (!calendar) return;
    const syncTheme = () => {
      calendar.setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [calendar]);

  useEffect(() => {
    if (!calendar) return;
    let cancelled = false;
    let attempts = 0;
    const applyTimezone = () => {
      if (cancelled) return;
      try {
        // $app is assigned in plugin beforeRender/onRender after ScheduleXCalendar mounts.
        calendarControls.setTimezone(timeZone as `${string}/${string}`);
      } catch {
        if (attempts++ < 180) requestAnimationFrame(applyTimezone);
      }
    };
    const frame = requestAnimationFrame(applyTimezone);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [calendar, calendarControls, timeZone]);

  useEffect(() => {
    if (!calendar) return;
    const root = calendarRootRef.current;
    if (!root) return;
    const detachLabel = attachCurrentTimeAxisLabel(root, { timeZone, locale: "zh-CN" });
    const detachPastPointer = attachPastSlotPointerGuard(root);
    return () => {
      detachLabel();
      detachPastPointer();
    };
  }, [calendar, timeZone]);

  useEffect(() => {
    const applyBackgrounds = () => {
      const past = pastBackgroundEvents(rangeStart, rangeEnd, timeZone);
      if (!addScheduleOpen) {
        eventsService.setBackgroundEvents(past);
        return;
      }
      const { start, end } = halfHourSlotRange(addScheduleAt, timeZone);
      eventsService.setBackgroundEvents([
        ...past,
        {
          title: "排期选中",
          start,
          end,
          style: {
            background: "color-mix(in srgb, var(--emphasis) 16%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--emphasis) 42%, transparent)",
            borderRadius: "4px",
          },
        },
      ]);
    };

    applyBackgrounds();
    const timer = window.setInterval(applyBackgrounds, 60_000);
    return () => {
      window.clearInterval(timer);
      eventsService.setBackgroundEvents(pastBackgroundEvents(rangeStart, rangeEnd, timeZone));
    };
  }, [addScheduleOpen, addScheduleAt, eventsService, rangeEnd, rangeStart, timeZone]);

  const reloadVisible = async () => {
    const range = rangeRef.current;
    if (!range) return;
    const entries = await window.desktop.calendar(range);
    entriesRef.current = new Map(entries.map((entry) => [entry.task.id, entry]));
    eventsService.set(
      entries.map((entry) => toScheduleEvent(entry, accountsRef.current, timeZoneRef.current)),
    );
    await queryClient.invalidateQueries({ queryKey: ["desktop", "calendar"] });
  };

  const onDisplayChange = useCallback(
    (next: CalendarDisplay) => {
      setDisplay(next);
      try {
        calendarControls.setView(displayToViewName(next));
      } catch (error) {
        console.error("Failed to change calendar view", error);
      }
    },
    [calendarControls],
  );

  const onPrevious = useCallback(() => {
    try {
      const date = calendarControls.getDate();
      calendarControls.setDate(shiftPlainDate(date, display, -1));
    } catch (error) {
      console.error("Failed to go to previous period", error);
    }
  }, [calendarControls, display]);

  const onNext = useCallback(() => {
    try {
      const date = calendarControls.getDate();
      calendarControls.setDate(shiftPlainDate(date, display, 1));
    } catch (error) {
      console.error("Failed to go to next period", error);
    }
  }, [calendarControls, display]);

  const onToday = useCallback(() => {
    try {
      calendarControls.setDate(Temporal.Now.plainDateISO(timeZoneRef.current));
    } catch (error) {
      console.error("Failed to jump to today", error);
    }
  }, [calendarControls]);

  const onAddSchedule = useCallback(() => {
    openAddScheduleRef.current(defaultScheduleAt(), null);
  }, []);

  const onTimezoneChange = useCallback(
    (next: string) => {
      setDesktopBehavior({ calendarTimezone: next });
    },
    [setDesktopBehavior],
  );

  const confirmAddSchedule = () => {
    const min = minutesFromNow(2);
    const at = addScheduleAt.getTime() < min.getTime() ? min : addScheduleAt;
    setAddScheduleOpen(false);
    if (!accounts.length) {
      toast.info("请先在账号管理中添加并登录账号，再排期发布。");
      setPage("accounts");
      return;
    }
    openComposeSchedule(at);
  };

  return (
    <DocumentPage>
      <PanelErrorBoundary
        title="内容日历暂时无法显示"
        description="请重试；若仍失败，可先使用创作或其他页面。详细信息已写入本地日志。"
      >
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto px-8 py-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">内容日历</h1>
            <p className="text-sm text-muted-foreground">
              点击空白时段添加排期；点击已排期条目可改期。网格按所选时区显示，到点发布需保持应用运行。
            </p>
          </div>

          <CalendarControlsBar
            display={display}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPrevious={onPrevious}
            onNext={onNext}
            onToday={onToday}
            onDisplayChange={onDisplayChange}
            onAddSchedule={onAddSchedule}
            timezone={storedTimezone}
            onTimezoneChange={onTimezoneChange}
          />

          <div
            ref={calendarRootRef}
            className="sx-react-calendar-wrapper mediax-calendar min-h-0 flex-1"
          >
            {calendar ? (
              <ScheduleXCalendar
                calendarApp={calendar}
                customComponents={calendarCustomComponents}
              />
            ) : null}
          </div>
        </div>

        <AddSchedulePopover
          open={addScheduleOpen}
          value={addScheduleAt}
          min={minutesFromNow(2)}
          timeZone={timeZone}
          hasAccounts={accounts.length > 0}
          anchor={addScheduleAnchor}
          onOpenChange={setAddScheduleOpen}
          onChange={setAddScheduleAt}
          onConfirm={confirmAddSchedule}
        />

        <Dialog open={Boolean(reschedule)} onOpenChange={(open) => !open && setReschedule(null)}>
          <DialogContent
            className="schedule-dialog gap-6 rounded-[var(--radius-dialog)] p-6 sm:max-w-[34rem]"
            showCloseButton={false}
          >
            <DialogHeader className="gap-3">
              <p className="schedule-dialog__brand">MediaX</p>
              <DialogTitle className="text-[1.75rem] leading-none tracking-tight">改期</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                修改后仍须保持 MediaX 运行，到点才会入队发布。
              </DialogDescription>
            </DialogHeader>
            <div className="schedule-dialog__hero" aria-hidden>
              <p className="schedule-dialog__clock">
                {new Intl.DateTimeFormat("zh-CN", {
                  timeZone,
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(scheduleAt)}
              </p>
              <p className="schedule-dialog__day">
                {new Intl.DateTimeFormat("zh-CN", {
                  timeZone,
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                }).format(scheduleAt)}
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="reschedule-at" className="text-sm">
                新的发布时间（{timeZone}）
              </Label>
              <DateTimePicker
                id="reschedule-at"
                value={scheduleAt}
                min={minutesFromNow(2)}
                timeZone={timeZone}
                size="lg"
                onChange={setScheduleAt}
              />
              <p className="text-sm text-muted-foreground">时区：{timeZone}</p>
            </div>
            <DialogFooter className="-mx-6 -mb-6 rounded-b-[var(--radius-dialog)] p-6">
              <Button variant="outline" size="lg" onClick={() => setReschedule(null)}>
                取消
              </Button>
              <Button
                size="lg"
                disabled={busy || !reschedule}
                onClick={() =>
                  void run(async () => {
                    if (!reschedule) return;
                    await window.desktop.rescheduleTask(
                      reschedule.task.id,
                      scheduleAt.toISOString(),
                    );
                    setReschedule(null);
                    await reloadVisible();
                  })
                }
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PanelErrorBoundary>
    </DocumentPage>
  );
}

function toScheduleEvent(
  entry: CalendarEntry,
  accounts: AccountInfo[],
  timeZone: string,
): CalendarEventExternal {
  const scheduled = entry.targets.every((t) => t.status === "scheduled");
  const startDate = new Date(entry.when);
  const endDate = new Date(startDate.getTime() + EVENT_MINUTES * 60_000);
  const publishers = publishersOf(entry, accounts);
  const title = entry.task.title?.trim() || entry.task.body.trim().split("\n")[0] || "未命名";

  return {
    id: entry.task.id,
    title,
    start: toZoned(startDate, timeZone),
    end: toZoned(endDate, timeZone),
    calendarId: scheduled ? "scheduled" : "published",
    publishers,
  };
}

function publishersOf(entry: CalendarEntry, accounts: AccountInfo[]): CalendarPublisher[] {
  const byAccount = new Map(accounts.map((account) => [account.id, account]));
  const seen = new Set<string>();
  const publishers: CalendarPublisher[] = [];
  for (const target of entry.targets) {
    if (seen.has(target.accountId)) continue;
    seen.add(target.accountId);
    const account = byAccount.get(target.accountId);
    const platform = (account?.platform ?? "facebook") as PlatformId;
    publishers.push({
      id: target.accountId,
      platform,
      name: account?.name ?? target.name,
      avatar: account?.avatar,
    });
  }
  return publishers;
}

function toZoned(date: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
