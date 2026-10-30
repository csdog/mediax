import type { Page } from "playwright-core";
import type { PlatformId } from "../../shared/models";
import { isPlatformLoginUrl, platformSites } from "../../shared/platformSites";
import { isCreatorPlatform, readCreatorProfile } from "./creatorProfile";
import { readAccountHeader, type AccountProfile } from "./pageProfile";
import { readBilibiliProfile } from "./bilibiliProfile";
import { readDouyinProfile } from "./douyinProfile";
import { readZhihuProfile } from "./zhihuProfile";
import { readWeiboProfile } from "../platforms/weibo/weiboProfile";

export function accountProfileScript(platform: PlatformId) {
  if (platform === "douyin") return `(${readDouyinProfile.toString()})()`;
  if (isCreatorPlatform(platform))
    return `(${readCreatorProfile.toString()})(${JSON.stringify(platform)})`;
  return `(${readAccountHeader.toString()})(${JSON.stringify({ platform, hosts: platformSites[platform].hosts })})`;
}

export async function readPlatformProfile(
  page: Page,
  platform: PlatformId,
): Promise<AccountProfile | null> {
  if (isPlatformLoginUrl(platform, page.url())) return null;
  if (platform === "bilibili") return page.evaluate(readBilibiliProfile, undefined);
  if (platform === "douyin") return page.evaluate(readDouyinProfile, undefined);
  if (platform === "zhihu") {
    const profile = await page.evaluate(readZhihuProfile, undefined);
    if (profile) return profile;
  }
  if (platform === "weibo") {
    const profile = await page.evaluate(readWeiboProfile, undefined);
    if (profile) return profile;
  }
  if (isCreatorPlatform(platform)) {
    await page.waitForFunction(readCreatorProfile, platform, { timeout: 10_000 }).catch(() => {});
    return page.evaluate(readCreatorProfile, platform);
  }
  const input = { platform, hosts: platformSites[platform].hosts };
  await page.waitForFunction(readAccountHeader, input, { timeout: 5_000 }).catch(() => {});
  return page.evaluate(readAccountHeader, input);
}
