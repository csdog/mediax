import { Temporal } from "temporal-polyfill";

const MIN_LEAD_MS = 2 * 60_000;
const SLOT_MINUTES = 30;

/** Resolve a clickable week/day slot into a future schedule time (Postiz-like). */
export function scheduleFromDateTime(
  dateTime: Temporal.ZonedDateTime,
  now = new Date(),
): Date | null {
  let snapped = snapZonedToHalfHour(dateTime);
  let at = new Date(snapped.epochMilliseconds);

  // Past slot (or already-started half-hour) → try the next half-hour once.
  if (at.getTime() <= now.getTime()) {
    snapped = snapped.add({ minutes: SLOT_MINUTES });
    at = new Date(snapped.epochMilliseconds);
    if (at.getTime() <= now.getTime()) return null;
  }

  return ensureMinLead(at, now);
}

/** Month/day cell → default clock time on that calendar day. */
export function scheduleFromPlainDate(
  date: Temporal.PlainDate,
  timeZone: string,
  now = new Date(),
): Date | null {
  const today = Temporal.Now.plainDateISO(timeZone);
  if (Temporal.PlainDate.compare(date, today) < 0) return null;

  if (Temporal.PlainDate.compare(date, today) === 0) {
    return ensureMinLead(new Date(now.getTime() + 60 * 60_000), now);
  }

  const zoned = date.toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from("09:00") });
  return ensureMinLead(new Date(zoned.epochMilliseconds), now);
}

export function defaultScheduleAt(now = new Date()) {
  return ensureMinLead(new Date(now.getTime() + 60 * 60_000), now);
}

/**
 * Half-hour cell covering `at` in `timeZone`.
 * :00–:29 → upper half [H:00, H:30); :30–:59 → lower half [H:30, H+1:00).
 */
export function halfHourSlotRange(at: Date, timeZone: string) {
  const zoned = Temporal.Instant.fromEpochMilliseconds(at.getTime()).toZonedDateTimeISO(timeZone);
  const start = snapZonedToHalfHour(zoned);
  return { start, end: start.add({ minutes: SLOT_MINUTES }) };
}

export function snapToHalfHour(at: Date, timeZone: string) {
  const zoned = Temporal.Instant.fromEpochMilliseconds(at.getTime()).toZonedDateTimeISO(timeZone);
  return new Date(snapZonedToHalfHour(zoned).epochMilliseconds);
}

/** Gray-out past days / elapsed hours in the visible calendar range. */
export function pastBackgroundEvents(
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
  now = new Date(),
) {
  const nowZoned = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(
    timeZone,
  );
  const today = nowZoned.toPlainDate();
  let day = Temporal.Instant.fromEpochMilliseconds(rangeStart.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const rangeEndDay = Temporal.Instant.fromEpochMilliseconds(rangeEnd.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();

  const events: Array<{
    title: string;
    start: Temporal.PlainDate | Temporal.ZonedDateTime;
    end: Temporal.PlainDate | Temporal.ZonedDateTime;
    style: Record<string, string>;
  }> = [];

  while (Temporal.PlainDate.compare(day, rangeEndDay) < 0) {
    if (Temporal.PlainDate.compare(day, today) > 0) break;

    if (Temporal.PlainDate.compare(day, today) < 0) {
      events.push({
        title: "过去",
        start: day,
        end: day,
        style: PAST_SLOT_STYLE,
      });
    } else {
      const dayStart = day.toZonedDateTime({
        timeZone,
        plainTime: Temporal.PlainTime.from("00:00"),
      });
      if (Temporal.ZonedDateTime.compare(nowZoned, dayStart) > 0) {
        events.push({
          title: "过去",
          start: dayStart,
          end: nowZoned,
          style: PAST_SLOT_STYLE,
        });
      }
    }

    day = day.add({ days: 1 });
  }

  return events;
}

const PAST_SLOT_STYLE = {
  background: "color-mix(in srgb, var(--foreground) 3%, transparent)",
  cursor: "not-allowed",
  pointerEvents: "auto",
};

function snapZonedToHalfHour(dateTime: Temporal.ZonedDateTime) {
  const minute = dateTime.minute < SLOT_MINUTES ? 0 : SLOT_MINUTES;
  return dateTime.with({ minute, second: 0, millisecond: 0 });
}

function ensureMinLead(at: Date, now: Date) {
  const min = now.getTime() + MIN_LEAD_MS;
  return at.getTime() < min ? new Date(min) : at;
}
