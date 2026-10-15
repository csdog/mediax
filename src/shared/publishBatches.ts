import type { AccountInfo, ContentKind, PlatformId, Target } from "./models";

export type PlatformContent = { title: string; body: string };

export type PublishContentBatch = {
  title: string | null;
  body: string;
  targets: Target[];
};

/** Group selected targets by resolved title/body (batch + per-platform overrides). */
export function groupPublishBatches(input: {
  kind: ContentKind;
  title: string;
  body: string;
  targets: Target[];
  accounts: AccountInfo[];
  platformContent: Partial<Record<PlatformId, PlatformContent>>;
}): PublishContentBatch[] {
  const groups = new Map<string, PublishContentBatch>();
  for (const target of input.targets) {
    const account = input.accounts.find((item) => item.id === target.accountId);
    if (!account) throw new Error("账号不存在");
    const override = input.platformContent[account.platform];
    const title = override?.title ?? input.title;
    const body = override?.body ?? input.body;
    const publishTitle =
      input.kind === "article" ? title : input.kind === "moment" ? null : title.trim() || null;
    const key = `${publishTitle ?? ""}\0${body}`;
    const existing = groups.get(key);
    if (existing) existing.targets.push(target);
    else groups.set(key, { title: publishTitle, body, targets: [target] });
  }
  return [...groups.values()];
}

export function platformHasCustomContent(
  platform: PlatformId,
  batch: PlatformContent,
  platformContent: Partial<Record<PlatformId, PlatformContent>>,
) {
  const override = platformContent[platform];
  if (!override) return false;
  return override.title !== batch.title || override.body !== batch.body;
}
