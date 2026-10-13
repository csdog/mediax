import type { Task, TaskTarget } from "../../shared/models";
export class NeedsUser extends Error {}
export class NotSubmitted extends Error {}
export interface Publisher {
  prepare(task: Task, target: TaskTarget): Promise<void>;
  submit(task: Task, target: TaskTarget, markSubmitted: () => void): Promise<void>;
  verify(task: Task, target: TaskTarget): Promise<string | null>;
}
