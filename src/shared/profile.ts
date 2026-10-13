export type ProfileSettings = { name: string; avatar: string | null };

export const defaultProfile: ProfileSettings = { name: "media-post", avatar: null };

const avatarPattern = /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

export function profileInitials(name: string) {
  const trimmed = name.trim() || defaultProfile.name;
  const parts = trimmed.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = [...parts[0]][0] ?? "";
    const second = [...parts[1]][0] ?? "";
    return `${first}${second}`.toUpperCase();
  }
  return [...trimmed].slice(0, 2).join("").toUpperCase() || "MP";
}

export function readProfile(value: unknown): ProfileSettings {
  if (!value || typeof value !== "object") return defaultProfile;
  const record = value as { name?: unknown; avatar?: unknown };
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 40) : "";
  const avatar = validAvatar(record.avatar) ? record.avatar : null;
  return { name: name || defaultProfile.name, avatar };
}

export function parseProfile(value: unknown): ProfileSettings {
  if (!value || typeof value !== "object") throw new Error("无效资料");
  const record = value as { name?: unknown; avatar?: unknown };
  if (typeof record.name !== "string" || !record.name.trim() || record.name.trim().length > 40)
    throw new Error("名称需要 1 到 40 个字");
  if (record.avatar !== null && !validAvatar(record.avatar)) throw new Error("头像无效");
  return { name: record.name.trim(), avatar: record.avatar };
}

function validAvatar(value: unknown): value is string {
  return typeof value === "string" && avatarPattern.test(value) && value.length <= 400_000;
}
