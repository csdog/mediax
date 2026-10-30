// Serialized into the account page as well as called with its Electron session.
export async function readDouyinProfile(
  request: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (url) =>
    fetch(url, { credentials: "include" }),
) {
  // These are the current creator site's own user-info endpoints, not public author profiles.
  for (const path of ["/aweme/v1/creator/pc/user/info/", "/aweme/v1/creator/user/info/"]) {
    try {
      const response = await request(`https://creator.douyin.com${path}`);
      if (!response.ok) continue;
      const result = (await response.json()) as {
        status_code?: number;
        user_profile?: { nick_name?: unknown; avatar_url?: unknown };
      } | null;
      if (result?.status_code === 8 || result?.status_code === 4) return null;
      const profile = result?.user_profile;
      if (result?.status_code !== 0 || typeof profile?.nick_name !== "string") continue;
      const name = profile.nick_name.trim();
      if (!name || name.length > 80) continue;
      let href: string | null = null;
      if (typeof profile.avatar_url === "string" && profile.avatar_url) {
        try {
          const url = new URL(profile.avatar_url, "https://creator.douyin.com");
          if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
        } catch {}
      }
      return { name, href };
    } catch {
      // The second creator endpoint remains available on some account types.
    }
  }
  return null;
}
