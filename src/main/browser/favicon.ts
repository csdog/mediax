import { nativeImage, type Session } from "electron";

const maxBytes = 256 * 1024;

/** Shrink a page favicon to a stored data URL. Remote icons are fetched in the page session. */
export async function loadFavicon(session: Session, favicons: string[]) {
  const sources = [...new Set(favicons)].filter(
    (item) => item.startsWith("data:image/") || /^https?:\/\//i.test(item),
  );
  for (const source of sources) {
    try {
      let buffer: Buffer;
      let original: string;
      if (source.startsWith("data:")) {
        const comma = source.indexOf(",");
        if (comma < 0 || source.slice(comma + 1).length > maxBytes) continue;
        original = source;
        buffer = source.slice(0, comma).includes(";base64")
          ? Buffer.from(source.slice(comma + 1), "base64")
          : Buffer.from(decodeURIComponent(source.slice(comma + 1)));
      } else {
        const response = await session.fetch(source, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) continue;
        buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > maxBytes) continue;
        const mime = response.headers.get("content-type")?.split(";")[0].trim();
        if (mime && !mime.startsWith("image/")) continue;
        original = `data:${mime?.startsWith("image/") ? mime : "image/x-icon"};base64,${buffer.toString("base64")}`;
      }
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) return original;
      const dataUrl = image.resize({ width: 32 }).toDataURL();
      if (dataUrl.startsWith("data:image/")) return dataUrl;
    } catch {
      // Try the next candidate when the first favicon is unavailable.
    }
  }
}
