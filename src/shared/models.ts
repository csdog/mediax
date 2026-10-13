export type Account = { id: string; name: string };
export type Target = {
  accountId: string;
  identityId: string;
  name: string;
  kind: "profile" | "page";
};
export type Status =
  | "pending"
  | "running"
  | "awaiting_user"
  | "submitted"
  | "verified"
  | "failed"
  | "unknown";
export type Task = {
  id: string;
  body: string;
  images: string[];
  createdAt: string;
  cover?: string | null;
};
export type TaskTarget = Target & {
  id: string;
  taskId: string;
  status: Status;
  error: string | null;
  url: string | null;
};
export type ImageAsset = { path: string; preview: string; name: string };
export type AccountInfo = Account & {
  login: "unchecked" | "logged_out" | "logged_in" | "needs_verification";
  targets: Target[];
  message?: string;
  avatar?: string;
};
export type ShortcutSettings = { accelerator: string; registered: boolean; error?: string };
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
export type BrowserPreview = { title: string; hostname: string; image: string | null };
export type WorkspaceSession = {
  tabs: { id: string; kind?: "new" }[];
  activeId: string | null;
  page: DesktopPage;
};
export type TabAction = "new" | "close" | "next" | "previous" | "reopen";
export interface DesktopApi {
  workspaceSession(): Promise<WorkspaceSession | null>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<void>;
  previewAccountBrowser(id: string): Promise<BrowserPreview>;
  layoutAccountBrowser(id: string | null, bounds?: BrowserBounds): Promise<void>;
  showTabPreview?(preview: TabPreviewOverlay): Promise<void>;
  hideTabPreview?(): Promise<void>;
  closeAccountBrowser(id: string): Promise<void>;
  shortcutSettings(): Promise<ShortcutSettings>;
  setGlobalShortcut(accelerator: string): Promise<ShortcutSettings>;
  publishSettings(): Promise<{ silent: boolean }>;
  setSilentPublish(silent: boolean): Promise<{ silent: boolean }>;
  onCommand(listener: (command: DesktopCommand) => void): () => void;
  accounts(): Promise<AccountInfo[]>;
  addAccount(name: string): Promise<AccountInfo>;
  openAccount(id: string): Promise<void>;
  refreshAccount(id: string): Promise<AccountInfo>;
  deleteAccount(id: string): Promise<void>;
  importMarkdown(): Promise<string | null>;
  chooseImages(): Promise<ImageAsset[]>;
  saveDraft(body: string, images: ImageAsset[]): Promise<void>;
  loadDraft(): Promise<{ body: string; images: ImageAsset[] }>;
  publish(body: string, images: string[], targets: Target[]): Promise<string>;
  history(): Promise<{ tasks: Task[]; targets: TaskTarget[] }>;
  openPost(url: string): Promise<void>;
  verifyTarget(id: string, url?: string): Promise<void>;
  retry(id: string): Promise<void>;
  resume(id: string): Promise<void>;
}

export type DesktopPage = "accounts" | "compose" | "history";
export type DesktopCommand =
  | { action: "tab"; operation: TabAction }
  | { action: "settings" }
  | { action: "navigate"; page: DesktopPage; taskId?: string }
  | { action: "save-draft" }
  | { action: "import-markdown" };
