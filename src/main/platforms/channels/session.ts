/** Only the assistant workspace is proof that the QR callback has finished. */
export function isChannelsPlatformUrl(url: string) {
  try {
    const page = new URL(url);
    return page.hostname === "channels.weixin.qq.com" && /^\/platform(?:\/|$)/.test(page.pathname);
  } catch {
    return false;
  }
}
