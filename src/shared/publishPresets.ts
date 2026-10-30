import type { AccountInfo, ContentKind, Target } from "./models";
import type { PublishSettings } from "./publishSettings";
import { supportedKinds } from "./content";

export type PublishPresetInput = {
  name: string;
  contentKind: ContentKind;
  targets: Array<Pick<Target, "accountId" | "identityId" | "kind">>;
  settings: PublishSettings;
};
export type PublishPreset = PublishPresetInput & { id: string };

/** Resolve references to current identities, including their latest display names. */
export function resolvePresetTargets(preset: PublishPresetInput, accounts: AccountInfo[]) {
  return preset.targets.flatMap((ref) => {
    const account = accounts.find((account) => account.id === ref.accountId);
    if (!account || !supportedKinds(account.platform).includes(preset.contentKind)) return [];
    const target = account.targets.find(
      (target) => target.identityId === ref.identityId && target.kind === ref.kind,
    );
    return target ? [target] : [];
  });
}
