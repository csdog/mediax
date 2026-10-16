export const platforms = [
  "douyin",
  "kuaishou",
  "channels",
  "xiaohongshu",
  "bilibili",
  "baijiahao",
  "toutiao",
  "weibo",
  "zhihu",
  "qq",
  "sohu",
  "yidian",
  "dayu",
  "netease",
  "iqiyi",
  "weishi",
  "wechat",
  "sohuvideo",
  "pipixia",
  "tencentvideo",
  "duoduo",
  "meipai",
  "acfun",
  "kuaichuan",
  "xueqiu",
  "fengwang",
  "dewu",
  "jd",
  "douban",
  "csdn",
  "jianshu",
  "chejia",
  "xhsmerchant",
  "yiche",
  "dongche",
  "ximalaya",
  "xiaoyuzhou",
  "guanghe",
  "xhsdm",
  "tiktok",
  "youtube",
  "facebook",
  "instagram",
  "reddit",
  "threads",
  "twitter",
  "linkedin",
  "pinterest",
  "alipay",
  "hupu",
  "zsxq",
  "music163",
  "qqmusic",
  "qingting",
  "lizhi",
  "googlebusiness",
] as const;
export type PlatformId = (typeof platforms)[number];
export function isPlatform(value: unknown): value is PlatformId {
  return typeof value === "string" && (platforms as readonly string[]).includes(value);
}
export type AccountGroup = { id: string; name: string; accountIds: string[] };
export type Account = { id: string; name: string; platform: PlatformId };
export type Target = {
  accountId: string;
  identityId: string;
  name: string;
  kind: "profile" | "page";
};
export type Status =
  | "scheduled"
  | "pending"
  | "running"
  | "awaiting_user"
  | "submitted"
  | "verified"
  | "failed"
  | "unknown";
export type ContentKind = "article" | "moment" | "video" | "audio";
export type Task = {
  id: string;
  contentKind: ContentKind;
  title: string | null;
  body: string;
  images: string[];
  createdAt: string;
  /** ISO; null/undefined means publish immediately when created. */
  scheduledAt?: string | null;
  cover?: string | null;
};
export type TaskTarget = Target & {
  id: string;
  taskId: string;
  status: Status;
  error: string | null;
  url: string | null;
};
export type CalendarEntry = {
  task: Task;
  targets: TaskTarget[];
  when: string;
};
/** Analytics window: last N days, or inclusive calendar range (`YYYY-MM-DD`). */
export type AnalyticsQuery = {
  days?: number;
  /** Inclusive start day (`YYYY-MM-DD`). Takes precedence over `days` when set with `to`. */
  from?: string;
  /** Inclusive end day (`YYYY-MM-DD`). Defaults to today when only `from` is set. */
  to?: string;
};

export type AnalyticsSummary = {
  days: number;
  since: string;
  until: string;
  totals: {
    tasks: number;
    targets: number;
    verified: number;
    failed: number;
    awaitingUser: number;
    scheduled: number;
    pendingOrRunning: number;
  };
  successRate: number | null;
  byPlatform: Array<{ platform: PlatformId; targets: number; verified: number; failed: number }>;
  byAccount: Array<{
    accountId: string;
    name: string;
    platform: PlatformId;
    targets: number;
    verified: number;
    failed: number;
  }>;
  daily: Array<{ date: string; tasks: number; verified: number; failed: number }>;
};
export type ImageAsset = { path: string; preview: string; name: string };
export type AccountInfo = Account & {
  login: "unchecked" | "logged_out" | "logged_in" | "needs_verification";
  targets: Target[];
  message?: string;
  avatar?: string;
};
export type ShortcutSettings = {
  /** @deprecated Prefer `shortcuts["global-show"]`; kept for callers that only care about the global hotkey. */
  accelerator: string;
  registered: boolean;
  error?: string;
  shortcuts: Record<string, string>;
};
export type BrowserBounds = { x: number; y: number; width: number; height: number };
export type TabPreviewOverlay = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  lines: string[];
  image: string | null;
  alt: string;
  placeholder: boolean;
};
export type ToastOverlayItem = {
  icon?: string;
  type: string;
  title: string;
  description?: string;
};
export type ToastOverlay = {
  theme?: "light" | "dark";
  x: number;
  y: number;
  width: number;
  height: number;
  toasts: ToastOverlayItem[];
};
export type NativePopupKind = "downloads" | "extensions" | "history" | "browser-menu";
export type NativePopupAction =
  | { type: "open-downloads-folder" }
  | { type: "reveal-download"; id: string }
  | { type: "copy-download-url"; id: string }
  | { type: "copy-download-path"; id: string }
  | { type: "remove-download"; id: string }
  | { type: "find" }
  | { type: "print" }
  | { type: "zoom"; delta: number }
  | { type: "zoom-reset" }
  | { type: "screenshot" }
  | { type: "clear-data" }
  | { type: "show-downloads" }
  | { type: "settings" }
  | { type: "open-history"; url: string }
  | { type: "submit-omnibox"; value: string }
  | { type: "remove-history"; url: string };
export type NativePopupRequest = {
  kind: NativePopupKind;
  theme: "light" | "dark";
  focus: boolean;
  x: number;
  y: number;
  width: number;
  downloads?: BrowserDownload[];
  historyEntries?: BrowserHistoryEntry[];
  historyIndex?: number;
  historySearchQuery?: string;
  pageReady?: boolean;
  zoomPercent?: number;
};
export type NativePopupHostEvent =
  | { type: "closed" }
  | { type: "action"; action: NativePopupAction };
export type BrowserPreview = { title: string; hostname: string; image: string | null };
export type BrowserNavigation = {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
};
export type BrowserHistoryEntry = {
  url: string;
  title: string;
  visitedAt: number;
  icon?: string;
  accountId?: string;
  accountLabel?: string;
  accountAvatar?: string;
};
export type WebSearchProvider = {
  id: string;
  name: string;
  source?: "browser" | "system" | "fallback";
};
export type BrowserDownloadState = "progressing" | "completed" | "cancelled" | "interrupted";
export type BrowserDownload = {
  id: string;
  filename: string;
  url: string;
  path: string;
  state: BrowserDownloadState;
  receivedBytes: number;
  totalBytes: number;
  startedAt: number;
  endedAt?: number;
};
export type WorkspaceSession = {
  tabs: {
    id: string;
    kind?: "new" | "compose" | "web";
    contentKind?: ContentKind;
    url?: string;
  }[];
  activeId: string | null;
  page: DesktopPage;
};
export type TabAction = "new" | "close" | "next" | "previous" | "reopen";
export interface DesktopApi {
  workspaceSession(): Promise<WorkspaceSession | null>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<void>;
  previewAccountBrowser(id: string): Promise<BrowserPreview>;
  openWebBrowser(id: string, url: string): Promise<void>;
  resolveOmniboxUrl(input: string): Promise<string | null>;
  webSearchProvider(): Promise<WebSearchProvider>;
  browserNavigation(id: string): Promise<BrowserNavigation>;
  browserHistory(query: string): Promise<BrowserHistoryEntry[]>;
  removeBrowserHistory(url: string): Promise<void>;
  navigateBrowser(id: string, url: string): Promise<BrowserNavigation>;
  goBackBrowser(id: string): Promise<BrowserNavigation>;
  goForwardBrowser(id: string): Promise<BrowserNavigation>;
  reloadBrowser(id: string): Promise<BrowserNavigation>;
  browserZoom(id: string): Promise<{ factor: number; percent: number }>;
  setBrowserZoom(id: string, factor: number): Promise<{ factor: number; percent: number }>;
  printBrowser(id: string): Promise<void>;
  findInBrowser(
    id: string,
    query: string,
    options?: { forward?: boolean; findNext?: boolean },
  ): Promise<{ activeMatchOrdinal: number; matches: number }>;
  stopFindInBrowser(id: string): Promise<void>;
  screenshotBrowser(id: string): Promise<string | null>;
  clearBrowserData(id: string): Promise<void>;
  layoutAccountBrowser(id: string | null, bounds?: BrowserBounds): Promise<void>;
  showTabPreview?(preview: TabPreviewOverlay): Promise<void>;
  hideTabPreview?(): Promise<void>;
  showToastOverlay?(overlay: ToastOverlay): Promise<void>;
  hideToastOverlay?(): Promise<void>;
  showNativePopup(popup: NativePopupRequest): Promise<void>;
  hideNativePopup(): Promise<void>;
  onNativePopup(listener: (popup: NativePopupRequest) => void): () => void;
  onNativePopupHostEvent(listener: (event: NativePopupHostEvent) => void): () => void;
  notifyNativePopup(event: { type: "resize"; height: number } | NativePopupHostEvent): void;
  closeAccountBrowser(id: string): Promise<void>;
  shortcutSettings(): Promise<ShortcutSettings>;
  setGlobalShortcut(accelerator: string): Promise<ShortcutSettings>;
  setShortcut(id: string, accelerator: string): Promise<ShortcutSettings>;
  resetShortcuts(): Promise<ShortcutSettings>;
  updateStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<UpdateStatus>;
  installUpdate(): Promise<UpdateStatus>;
  autoUpdateEnabled(): Promise<boolean>;
  setAutoUpdateEnabled(enabled: boolean): Promise<boolean>;
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
  desktopBehavior(): Promise<{ keepAwakeWhilePublishing: boolean; calendarTimezone: string }>;
  setDesktopBehavior(settings: {
    keepAwakeWhilePublishing?: boolean;
    calendarTimezone?: string;
  }): Promise<{ keepAwakeWhilePublishing: boolean; calendarTimezone: string }>;
  publishSettings(): Promise<{
    silent: boolean;
    concurrency: number;
    bandwidthLimitKbps: number;
  }>;
  setSilentPublish(silent: boolean): Promise<{
    silent: boolean;
    concurrency: number;
    bandwidthLimitKbps: number;
  }>;
  setPublishSettings(settings: {
    silent?: boolean;
    concurrency?: number;
    bandwidthLimitKbps?: number;
  }): Promise<{ silent: boolean; concurrency: number; bandwidthLimitKbps: number }>;
  profileSettings(): Promise<{ name: string; avatar: string | null }>;
  setProfile(profile: { name: string; avatar: string | null }): Promise<{
    name: string;
    avatar: string | null;
  }>;
  chooseAvatar(): Promise<string | null>;
  notificationSettings(): Promise<{
    enabled: boolean;
    publishResult: boolean;
    awaitingUser: boolean;
    privacy: boolean;
    sound: boolean;
  }>;
  setNotificationSettings(settings: {
    enabled?: boolean;
    publishResult?: boolean;
    awaitingUser?: boolean;
    privacy?: boolean;
    sound?: boolean;
  }): Promise<{
    enabled: boolean;
    publishResult: boolean;
    awaitingUser: boolean;
    privacy: boolean;
    sound: boolean;
  }>;
  notificationPermission(): Promise<{ supported: boolean; label: string; detail: string }>;
  openNotificationSettings(): Promise<void>;
  testNotification(): Promise<{ ok: boolean; message: string }>;
  themePreference(): Promise<"system" | "light" | "dark">;
  setThemePreference(preference: "system" | "light" | "dark"): Promise<"system" | "light" | "dark">;
  diagnostics(): Promise<{
    generatedAt: string;
    app: { name: string; version: string; packaged: boolean };
    runtime: {
      electron: string;
      chrome: string;
      node: string;
      platform: string;
      arch: string;
    };
    paths: { userData: string; logsDir: string; logFile: string };
    counts: { accounts: number; tasks: number; targets: Record<string, number> };
    storage: {
      totalBytes: number;
      categories: Array<{ id: string; label: string; bytes: number }>;
    };
    logTail: string;
  }>;
  storageUsage(force?: boolean): Promise<{
    totalBytes: number;
    categories: Array<{ id: string; label: string; bytes: number }>;
  }>;
  clearStorage(
    id: "cache" | "logs" | "assets" | "sessions",
  ): Promise<{ freedBytes: number } | null>;
  exportDiagnostics(): Promise<string | null>;
  revealLogFile(): Promise<void>;
  openAtLogin(): Promise<{ openAtLogin: boolean; detail: string | null }>;
  setOpenAtLogin(openAtLogin: boolean): Promise<{ openAtLogin: boolean; detail: string | null }>;
  onCommand(listener: (command: DesktopCommand) => void): () => void;
  accountGroups(): Promise<AccountGroup[]>;
  setAccountGroups(accountId: string, groupIds: string[]): Promise<AccountGroup[]>;
  createAccountGroup(input: { name: string; accountIds: string[] }): Promise<AccountGroup>;
  accounts(): Promise<AccountInfo[]>;
  addAccount(name: string, platform: PlatformId): Promise<AccountInfo>;
  openAccount(id: string, url?: string): Promise<void>;
  refreshAccount(id: string): Promise<AccountInfo>;
  deleteAccount(id: string): Promise<void>;
  importMarkdown(): Promise<string | null>;
  chooseImages(kind?: ContentKind): Promise<ImageAsset[]>;
  importLocalFiles(
    paths: string[],
    kind: ContentKind,
  ): Promise<{ markdown: string | null; assets: ImageAsset[]; warnings: string[] }>;
  revealInFolder(path: string): Promise<void>;
  openDownloadsFolder(): Promise<void>;
  downloads(): Promise<BrowserDownload[]>;
  removeDownload(id: string): Promise<void>;
  revealDownload(id: string): Promise<void>;
  copyDownloadUrl(id: string): Promise<void>;
  copyDownloadPath(id: string): Promise<void>;
  onDownloadsChanged(listener: (items: BrowserDownload[]) => void): () => void;
  openExternalUrl(url: string): Promise<void>;
  pathForFile?(file: File): string;
  saveDraft(body: string, images: ImageAsset[], kind: ContentKind, title: string): Promise<void>;
  loadDraft(): Promise<{
    body: string;
    images: ImageAsset[];
    contentKind: ContentKind;
    title: string | null;
  }>;
  publish(
    kind: ContentKind,
    title: string | null,
    body: string,
    images: string[],
    targets: Target[],
    scheduledAt?: string | null,
  ): Promise<string>;
  /** Create one or more tasks with different title/body groups in a single submit. */
  publishBatches(
    kind: ContentKind,
    images: string[],
    batches: Array<{ title: string | null; body: string; targets: Target[] }>,
    scheduledAt?: string | null,
  ): Promise<string>;
  history(): Promise<{ tasks: Task[]; targets: TaskTarget[] }>;
  calendar(range: { from: string; to: string }): Promise<CalendarEntry[]>;
  rescheduleTask(taskId: string, scheduledAt: string): Promise<Task>;
  analyticsSummary(query?: number | AnalyticsQuery): Promise<AnalyticsSummary>;
  openPost(url: string): Promise<void>;
  verifyTarget(id: string, url?: string): Promise<void>;
  retry(id: string): Promise<void>;
  republish(id: string): Promise<void>;
  resume(id: string): Promise<void>;
}

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";
export type UpdateStatus = {
  state: UpdateState;
  currentVersion: string;
  availableVersion: string | null;
  progress: number | null;
  message: string | null;
  canCheck: boolean;
  canInstall: boolean;
};
export type DesktopPage =
  | "accounts"
  | "publish"
  | "compose"
  | "video"
  | "history"
  | "calendar"
  | "analytics";
export type DesktopCommand =
  | { action: "open-web"; url: string }
  | { action: "tab"; operation: TabAction }
  | { action: "settings" }
  | { action: "navigate"; page: DesktopPage; taskId?: string }
  | { action: "save-draft" }
  | { action: "import-markdown" }
  | { action: "toast"; title: string; body: string }
  | { action: "open-files"; paths: string[] };
