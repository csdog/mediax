type WeiboUser = { screen_name?: string; id?: string | number; idstr?: string };

/** Read the logged-in Weibo nickname. Serialized into the page; keep helpers inside. */
export async function readWeiboProfile(): Promise<{ name: string; id: string } | null> {
  const clean = (value: unknown) => {
    if (typeof value !== "string") return "";
    const name = value.trim();
    if (!name || name.length > 80) return "";
    if (name === "微博" || name === "新浪微博" || /账号$/.test(name)) return "";
    return name;
  };
  const fromUser = (user: WeiboUser | undefined) => {
    const name = clean(user?.screen_name);
    const id = String(user?.idstr || user?.id || "");
    if (!name || !/^\d+$/.test(id)) return null;
    return { name, id };
  };
  const app = document.querySelector("#app") as {
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
  if (direct) return direct;
  let uid = String(config?.uid ?? "");
  if (!/^\d+$/.test(uid)) {
    const payload = await fetch("https://weibo.com/ajax/config/get_config", {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    uid = String(payload?.data?.uid ?? "");
  }
  if (!/^\d+$/.test(uid)) return null;
  const info = await fetch(`https://weibo.com/ajax/profile/info?uid=${uid}`, {
    credentials: "include",
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  return fromUser(info?.data?.user);
}
