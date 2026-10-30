// Also serialized into the account page by Playwright; keep helpers inside this function.
export async function readBilibiliProfile(
  request: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (url) =>
    fetch(url, { credentials: "include" }),
) {
  try {
    const response = await request("https://api.bilibili.com/x/web-interface/nav");
    if (!response.ok) return null;
    const result = (await response.json()) as {
      code?: number;
      data?: { isLogin?: boolean; uname?: unknown; face?: unknown };
    } | null;
    const data = result?.data;
    if (result?.code !== 0 || data?.isLogin !== true || typeof data.uname !== "string") return null;
    const name = data.uname.trim();
    if (!name || name.length > 80) return null;
    let href: string | null = null;
    if (typeof data.face === "string" && data.face) {
      const url = new URL(data.face, "https://www.bilibili.com");
      if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
    }
    return { name, href };
  } catch {
    return null;
  }
}
