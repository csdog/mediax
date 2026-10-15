import { Temporal } from "temporal-polyfill";
import {
  PlatformAvatarGroup,
  type CalendarPublisher,
} from "@/components/calendar/PlatformAvatarGroup";
import { cn } from "cn";

export type MediaxCalendarEvent = {
  id: string | number;
  title?: string;
  start: Temporal.ZonedDateTime | Temporal.PlainDate;
  calendarId?: string;
  publishers?: CalendarPublisher[];
};

/** Week/day timed event: platform avatars + title + single publish time. */
export function TimeGridEventCard({ calendarEvent }: { calendarEvent: MediaxCalendarEvent }) {
  const scheduled = calendarEvent.calendarId === "scheduled";
  const publishers = calendarEvent.publishers ?? [];
  const time = formatPublishTime(calendarEvent.start);

  return (
    <div
      className={cn(
        "mediax-cal-event",
        scheduled ? "mediax-cal-event--scheduled" : "mediax-cal-event--published",
      )}
    >
      {calendarEvent.title ? (
        <div className="mediax-cal-event__title">{calendarEvent.title}</div>
      ) : null}
      <div className="mediax-cal-event__avatars">
        <PlatformAvatarGroup publishers={publishers} />
      </div>
      {time ? <div className="mediax-cal-event__time">{time}</div> : null}
    </div>
  );
}

/** Month cell event: compact avatars + title. */
export function MonthGridEventCard({
  calendarEvent,
}: {
  calendarEvent: MediaxCalendarEvent;
  hasStartDate?: boolean;
}) {
  const scheduled = calendarEvent.calendarId === "scheduled";
  const publishers = calendarEvent.publishers ?? [];
  const time = formatPublishTime(calendarEvent.start);

  return (
    <div
      className={cn(
        "mediax-cal-event mediax-cal-event--month",
        scheduled ? "mediax-cal-event--scheduled" : "mediax-cal-event--published",
      )}
    >
      <PlatformAvatarGroup publishers={publishers} />
      {time ? <span className="mediax-cal-event__time">{time}</span> : null}
      {calendarEvent.title ? (
        <span className="mediax-cal-event__title">{calendarEvent.title}</span>
      ) : null}
    </div>
  );
}

function formatPublishTime(start: Temporal.ZonedDateTime | Temporal.PlainDate) {
  if (start instanceof Temporal.PlainDate || !("epochMilliseconds" in start)) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: start.timeZoneId,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(start.epochMilliseconds));
}
