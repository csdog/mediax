import type { PlatformId, Target } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";

export function isGeneratedAccountName(name: string) {
  return /^.+\s账号\s\d+$/.test(name.trim());
}

export function normalizeAccountName(name: string) {
  const trimmed = name.trim();
  const wrapped = trimmed.match(/^(?:点击)?(?:打开|进入)(.+?)的(?:个人)?主页$/);
  return (wrapped?.[1] ?? trimmed).trim();
}

export function usableAccountName(platform: PlatformId, name: string | null | undefined) {
  const trimmed = normalizeAccountName(name ?? "");
  if (!trimmed || isGeneratedAccountName(trimmed) || isGenericProfileName(platform, trimmed))
    return null;
  return trimmed.slice(0, 80);
}

export function shouldAdoptAccountName(current: string, next: string | null) {
  if (!next || next === current) return false;
  return isGeneratedAccountName(current) || normalizeAccountName(current) !== current.trim();
}

export function discoveredAccountName(platform: PlatformId, targets: Target[]) {
  const profile = targets.find((target) => target.kind === "profile") ?? targets[0];
  return usableAccountName(platform, profile?.name);
}

function isGenericProfileName(platform: PlatformId, name: string) {
  const label = platformInfo[platform].label;
  if (name === label || name === `${label}账号` || name === `${label} 账号`) return true;
  if (name.startsWith(label) && /账号|频道$/.test(name)) return true;
  return /^[\u4e00-\u9fa5A-Za-z0-9]{1,8}账号$/.test(name);
}
