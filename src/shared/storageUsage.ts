export type StorageCategoryId = "database" | "sessions" | "assets" | "logs" | "cache" | "other";

export type StorageCategory = {
  id: StorageCategoryId;
  label: string;
  bytes: number;
};

export type StorageUsage = {
  totalBytes: number;
  categories: StorageCategory[];
};

/** Palette aligned with Codex storage legend. */
export const storageCategoryMeta: Record<StorageCategoryId, { label: string; color: string }> = {
  database: { label: "数据库", color: "#e6c04a" },
  sessions: { label: "浏览器会话", color: "#7c6cf0" },
  assets: { label: "发布素材", color: "#e0893a" },
  logs: { label: "日志", color: "#e25b5b" },
  cache: { label: "缓存", color: "#5cbf6a" },
  other: { label: "其他", color: "#9aa3af" },
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 字节";
  const units = ["字节", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 1;
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(digits);
  return `${text.replace(/\.0$/, "")} ${units[unit]}`;
}

export function buildStorageUsage(bytesById: Record<StorageCategoryId, number>): StorageUsage {
  const order: StorageCategoryId[] = ["database", "sessions", "assets", "logs", "cache", "other"];
  const categories = order.map((id) => ({
    id,
    label: storageCategoryMeta[id].label,
    bytes: Math.max(0, Math.round(bytesById[id] ?? 0)),
  }));
  return {
    totalBytes: categories.reduce((sum, item) => sum + item.bytes, 0),
    categories,
  };
}

/** Disposable categories that settings can clear (not database / other). */
export type StorageCleanupId = "cache" | "logs" | "assets" | "sessions";

export type StorageCleanupAction = {
  id: StorageCleanupId;
  title: string;
  description: string;
  confirm: string;
  button: string;
  /** Destructive actions use red controls. */
  dangerous: boolean;
  emptyMessage: string;
  doneLabel: string;
};

export const storageCleanupActions: StorageCleanupAction[] = [
  {
    id: "cache",
    title: "清理缓存",
    description: "删除应用与账号分区内的磁盘/代码缓存，保留登录态，不影响素材与日志",
    confirm:
      "确定清理应用缓存？将删除应用与账号分区内的磁盘/代码缓存，保留登录态，不影响素材与日志。",
    button: "清理缓存",
    dangerous: false,
    emptyMessage: "缓存已为空，无需清理",
    doneLabel: "缓存",
  },
  {
    id: "logs",
    title: "清理日志",
    description: "清空当前日志并删除滚动归档，不影响账号、素材与浏览器会话",
    confirm: "确定清理应用日志？将清空当前日志并删除滚动归档，不影响账号、素材与浏览器会话。",
    button: "清理日志",
    dangerous: false,
    emptyMessage: "日志已为空，无需清理",
    doneLabel: "日志",
  },
  {
    id: "assets",
    title: "清理发布素材",
    description: "删除本地发布任务素材副本；进行中的发布可能失败",
    confirm:
      "确定清理发布素材？将删除本地任务素材副本，进行中的发布可能失败。账号登录态与日志不受影响。",
    button: "清理素材",
    dangerous: true,
    emptyMessage: "发布素材已为空，无需清理",
    doneLabel: "发布素材",
  },
  {
    id: "sessions",
    title: "清理浏览器会话",
    description: "清除全部账号登录态与分区数据，之后需要重新登录各平台",
    confirm: "确定清理浏览器会话？将清除全部账号登录态，之后需要重新登录各平台。此操作不可撤销。",
    button: "清理会话",
    dangerous: true,
    emptyMessage: "浏览器会话已为空，无需清理",
    doneLabel: "浏览器会话",
  },
];

export function isStorageCleanupId(value: unknown): value is StorageCleanupId {
  return value === "cache" || value === "logs" || value === "assets" || value === "sessions";
}
