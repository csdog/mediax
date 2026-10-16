import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AccountGroup } from "../../shared/models";
import type { Database } from "../storage/Database";

const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  accountIds: z.array(z.string()),
});
const inputSchema = groupSchema.omit({ id: true });
const key = "accountGroups";

export function readAccountGroups(db: Database): AccountGroup[] {
  const parsed = z.array(groupSchema).safeParse(db.setting(key) ?? []);
  if (!parsed.success) throw new Error("分组数据无法读取，请稍后重试");
  const known = new Set(db.accounts().map((a) => a.id));
  return parsed.data.map((group) => ({
    ...group,
    accountIds: group.accountIds.filter((id) => known.has(id)),
  }));
}

export function createAccountGroup(db: Database, input: unknown): AccountGroup {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error("请填写 1 至 40 字的分组名称，并选择有效账号");
  const groups = readAccountGroups(db);
  if (groups.some((g) => g.name.toLocaleLowerCase() === parsed.data.name.toLocaleLowerCase()))
    throw new Error("已存在同名分组，请换一个名称");
  const known = new Set(db.accounts().map((a) => a.id));
  if (parsed.data.accountIds.some((id) => !known.has(id)))
    throw new Error("账号已不存在，请重新选择");
  const group: AccountGroup = {
    id: randomUUID(),
    name: parsed.data.name,
    accountIds: [...new Set(parsed.data.accountIds)],
  };
  db.setSetting(key, [...groups, group]);
  return group;
}

/** Update one account across all groups in one write, preserving other accounts. */
export function setAccountGroups(
  db: Database,
  accountId: unknown,
  groupIds: unknown,
): AccountGroup[] {
  if (typeof accountId !== "string" || !db.accounts().some((a) => a.id === accountId))
    throw new Error("账号不存在，请刷新账号列表");
  const parsed = z.array(z.string()).safeParse(groupIds);
  if (!parsed.success) throw new Error("请选择有效的账号分组");
  const groups = readAccountGroups(db);
  const selected = new Set(parsed.data);
  if (parsed.data.some((id) => !groups.some((group) => group.id === id)))
    throw new Error("分组已不存在，请重新打开账号设置");
  const next = groups.map((group) => ({
    ...group,
    accountIds: selected.has(group.id)
      ? [...new Set([...group.accountIds, accountId])]
      : group.accountIds.filter((id) => id !== accountId),
  }));
  db.setSetting(key, next);
  return next;
}
