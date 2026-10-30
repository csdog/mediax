import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AccountInfo } from "../../shared/models";
import { resolvePresetTargets, type PublishPreset } from "../../shared/publishPresets";
import type { Database } from "../storage/Database";

const presetSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  contentKind: z.enum(["article", "moment", "video", "audio"]),
  targets: z
    .array(
      z.object({
        accountId: z.string().min(1),
        identityId: z.string().regex(/^\d+$/),
        kind: z.enum(["profile", "page"]),
      }),
    )
    .min(1),
  settings: z.object({
    silent: z.boolean(),
    concurrency: z.number().int().min(1),
    bandwidthLimitKbps: z.number().int().min(0),
  }),
});
const inputSchema = presetSchema.omit({ id: true });
const key = "publishPresets";

export function readPublishPresets(db: Database): PublishPreset[] {
  const parsed = z.array(presetSchema).safeParse(db.setting(key) ?? []);
  if (!parsed.success) throw new Error("发布方案无法读取，请稍后重试");
  return parsed.data;
}

export function createPublishPreset(
  db: Database,
  input: unknown,
  accounts: AccountInfo[],
): PublishPreset {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error("请填写 1 至 40 字的方案名称，并选择有效的发布身份和设置");
  const presets = readPublishPresets(db);
  const value = parsed.data;
  if (
    presets.some(
      (preset) =>
        preset.contentKind === value.contentKind &&
        preset.name.toLocaleLowerCase() === value.name.toLocaleLowerCase(),
    )
  )
    throw new Error("已存在同名发布方案，请换一个名称");
  if (resolvePresetTargets(value, accounts).length !== value.targets.length)
    throw new Error("部分发布身份已失效，请重新选择后保存");
  const seen = new Set<string>();
  const targets = value.targets.filter((target) => {
    const id = JSON.stringify([target.accountId, target.identityId, target.kind]);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const preset: PublishPreset = { ...value, targets, id: randomUUID() };
  db.setSetting(key, [...presets, preset]);
  return preset;
}

export function deletePublishPreset(db: Database, id: unknown): PublishPreset[] {
  if (typeof id !== "string") throw new Error("请选择有效的发布方案");
  const presets = readPublishPresets(db);
  const next = presets.filter((preset) => preset.id !== id);
  db.setSetting(key, next);
  return next;
}
