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
};
export interface DesktopApi {
  accounts(): Promise<AccountInfo[]>;
  addAccount(name: string): Promise<AccountInfo>;
  openAccount(id: string): Promise<void>;
  refreshAccount(id: string): Promise<AccountInfo>;
  importMarkdown(): Promise<string | null>;
  chooseImages(): Promise<ImageAsset[]>;
  saveDraft(body: string, images: ImageAsset[]): Promise<void>;
  loadDraft(): Promise<{ body: string; images: ImageAsset[] }>;
  publish(body: string, images: string[], targets: Target[]): Promise<string>;
  history(): Promise<{ tasks: Task[]; targets: TaskTarget[] }>;
  retry(id: string): Promise<void>;
  resume(id: string): Promise<void>;
}
