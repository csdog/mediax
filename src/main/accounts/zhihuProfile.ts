// Serialized into the account page as well as used with Electron's partition fetch.
export async function readZhihuProfile(
  request: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (url) =>
    fetch(url, { credentials: "include", signal: AbortSignal.timeout(10_000) }),
) {
  try {
    const response = await request("https://www.zhihu.com/api/v4/me");
    if (!response.ok) return null;
    const data = (await response.json()) as {
      id?: unknown;
      name?: unknown;
      avatar_url?: unknown;
      error?: unknown;
    } | null;
    if (
      !data ||
      data.error ||
      typeof data.id !== "string" ||
      !data.id ||
      typeof data.name !== "string"
    )
      return null;
    const name = data.name.trim();
    if (!name || name.length > 80) return null;
    let href: string | null = null;
    if (typeof data.avatar_url === "string" && data.avatar_url) {
      try {
        const url = new URL(data.avatar_url, "https://www.zhihu.com");
        if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
      } catch {
        /* Keep the verified name. */
      }
    }
    return { name, href };
  } catch {
    return null;
  }
}
