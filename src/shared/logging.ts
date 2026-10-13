import { z } from "zod";

const logLevelColors: Record<string, string> = {
  error: "red",
  warn: "yellow",
  info: "cyan",
  verbose: "unset",
  debug: "gray",
  silly: "gray",
};

function formatLogTime(date: Date) {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const offset = date.getTimezoneOffset();
  const sign = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const zone = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
  return `[${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)} ${zone}]`;
}

function levelLabel(level: string) {
  return `${level.toUpperCase()}]`.padEnd(6, " ");
}

export function formatLogPrefix(date: Date, level: string, processType: string) {
  return `${formatLogTime(date)} [${levelLabel(level)} [${processType}]`;
}

export function formatConsoleData(date: Date, level: string, processType: string, data: unknown[]) {
  return [
    `${formatLogTime(date)} %c[${levelLabel(level)}%c [${processType}]`,
    `color:${logLevelColors[level] ?? "unset"}`,
    "color:unset",
    ...data,
  ];
}

export const logLevelSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  z.union([
    z.enum(["error", "warn", "info", "verbose", "debug", "silly"]),
    z.literal("false").transform(() => false as const),
  ]),
);

export function readLogConfig(env: {
  MODE?: string;
  VITE_LOG_CONSOLE_LEVEL?: string;
  MAIN_VITE_LOG_FILE_LEVEL?: string;
  MAIN_VITE_LOG_MAX_SIZE?: string;
}) {
  const level = env.MODE === "development" ? "debug" : "info";
  return {
    mode: env.MODE ?? "production",
    consoleLevel: logLevelSchema.default(level).parse(env.VITE_LOG_CONSOLE_LEVEL),
    fileLevel: logLevelSchema.default(level).parse(env.MAIN_VITE_LOG_FILE_LEVEL),
    maxSize: z.coerce
      .number()
      .int()
      .min(1024)
      .max(100 * 1024 * 1024)
      .default(5 * 1024 * 1024)
      .parse(env.MAIN_VITE_LOG_MAX_SIZE),
  };
}
