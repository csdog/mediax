type WeiboUser = {
  screen_name?: string;
  id?: string | number;
  idstr?: string;
  avatar_hd?: string;
  avatar_large?: string;
  profile_image_url?: string;
};
type WeiboResponse = { ok?: number; data?: { uid?: string | number; user?: WeiboUser } };

/** Read the logged-in Weibo nickname. Serialized into the page; keep helpers inside. */
export async function readWeiboProfile(
  request: (url: string) => Promise<{ ok: boolean; json(): Promise<WeiboResponse | null> }> = (
    url,
  ) => fetch(url, { credentials: "include", signal: AbortSignal.timeout(10_000) }),
): Promise<{ name: string; id: string; href: string | null } | null> {
  const clean = (value: unknown) => {
    if (typeof value !== "string") return "";
    const name = value.trim();
    if (!name || name.length > 80) return "";
    if (name === "微博" || name === "新浪微博" || name === "微博账号") return "";
    return name;
  };
  const fromUser = (user: WeiboUser | undefined) => {
    const name = clean(user?.screen_name);
    const id = String(user?.idstr || user?.id || "");
    if (!name || !/^\d+$/.test(id)) return null;
    let href: string | null = null;
    const face = user?.avatar_hd || user?.avatar_large || user?.profile_image_url;
    if (face) {
      try {
        const url = new URL(face, "https://weibo.com");
        if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
      } catch {
        /* Keep the verified nickname. */
      }
    }
    return { name, id, href };
  };
  const app = (typeof document === "undefined" ? null : document.querySelector("#app")) as {
    __vue_app__?: {
      config?: {
        globalProperties?: {
          $store?: {
            state?: {
              config?: { config?: { uid?: string | number; user?: WeiboUser } };
            };
          };
        };
      };
    };
  } | null;
  const config = app?.__vue_app__?.config?.globalProperties?.$store?.state?.config?.config;
  const direct = fromUser(config?.user);
  if (direct?.href) return direct;
  let uid = String(config?.uid ?? direct?.id ?? "");
  if (!/^\d+$/.test(uid)) {
    const payload = await request("https://weibo.com/ajax/config/get_config")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    uid = String(payload?.data?.uid ?? "");
  }
  if (!/^\d+$/.test(uid)) return direct;
  const info = await request(`https://weibo.com/ajax/profile/info?uid=${uid}`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  const profile = fromUser(info?.data?.user);
  return profile?.id === uid ? profile : direct;
}
