import { normalizeStoredTimeZone, SYSTEM_TIMEZONE } from "./timezones";

export type DesktopBehavior = {
  /** Keep the machine awake while publish tasks are active. */
  keepAwakeWhilePublishing: boolean;
  /** IANA timezone for calendar / schedule UI, or "system". */
  calendarTimezone: string;
};

export const defaultDesktopBehavior: DesktopBehavior = {
  keepAwakeWhilePublishing: true,
  calendarTimezone: SYSTEM_TIMEZONE,
};

export function readDesktopBehavior(get: (key: string) => unknown): DesktopBehavior {
  return {
    keepAwakeWhilePublishing: get("keepAwakeWhilePublishing") !== false,
    calendarTimezone: normalizeStoredTimeZone(get("calendarTimezone")),
  };
}

export function mergeDesktopBehavior(
  current: DesktopBehavior,
  patch: Partial<DesktopBehavior>,
): DesktopBehavior {
  return {
    keepAwakeWhilePublishing:
      typeof patch.keepAwakeWhilePublishing === "boolean"
        ? patch.keepAwakeWhilePublishing
        : current.keepAwakeWhilePublishing,
    calendarTimezone:
      patch.calendarTimezone === undefined
        ? current.calendarTimezone
        : normalizeStoredTimeZone(patch.calendarTimezone),
  };
}
