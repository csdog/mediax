/** Sentinel: follow the host OS timezone. */
export const SYSTEM_TIMEZONE = "system";

export type TimezoneOption = {
  value: string;
  label: string;
};

/** Curated IANA zones for calendar / scheduling UI. */
export const CALENDAR_TIMEZONES: TimezoneOption[] = [
  { value: SYSTEM_TIMEZONE, label: "系统时区" },
  { value: "Asia/Shanghai", label: "中国标准时间 (上海)" },
  { value: "Asia/Hong_Kong", label: "香港" },
  { value: "Asia/Taipei", label: "台北" },
  { value: "Asia/Tokyo", label: "东京" },
  { value: "Asia/Singapore", label: "新加坡" },
  { value: "Asia/Seoul", label: "首尔" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "伦敦" },
  { value: "Europe/Paris", label: "巴黎" },
  { value: "America/New_York", label: "纽约" },
  { value: "America/Chicago", label: "芝加哥" },
  { value: "America/Los_Angeles", label: "洛杉矶" },
  { value: "America/Sao_Paulo", label: "圣保罗" },
  { value: "Australia/Sydney", label: "悉尼" },
];

export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}

export function resolveTimeZone(stored: string | null | undefined) {
  if (!stored || stored === SYSTEM_TIMEZONE) return systemTimeZone();
  return isValidTimeZone(stored) ? stored : systemTimeZone();
}

export function normalizeStoredTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return SYSTEM_TIMEZONE;
  const next = value.trim();
  if (next === SYSTEM_TIMEZONE) return SYSTEM_TIMEZONE;
  return isValidTimeZone(next) ? next : SYSTEM_TIMEZONE;
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function timezoneLabel(stored: string) {
  const resolved = resolveTimeZone(stored);
  if (stored === SYSTEM_TIMEZONE || !stored) {
    return `系统时区 (${resolved})`;
  }
  return CALENDAR_TIMEZONES.find((item) => item.value === stored)?.label ?? stored;
}
