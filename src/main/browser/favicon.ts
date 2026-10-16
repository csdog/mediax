import { nativeImage, type Session } from "electron";

const maxBytes = 256 * 1024;

function pickFavicon(favicons: string[]) {
  return (
    favicons.find((item) => item.startsWith("data:image/")) ??
    favicons.find((item) => /^https?:\/\//i.test(item))
  );
}

/** Shrink a page favicon to a stored data URL. Remote icons are fetched in the page session. */
export async function loadFavicon(session: Session, favicons: string[]) {
  const source = pickFavicon(favicons);
  if (!source) return;
  try {
    let buffer: Buffer;
    let original: string;
    if (source.startsWith("data:")) {
      const comma = source.indexOf(",");
      if (comma < 0 || source.slice(comma + 1).length > maxBytes) return;
      original = source;
      buffer = source.slice(0, comma).includes(";base64")
        ? Buffer.from(source.slice(comma + 1), "base64")
        : Buffer.from(decodeURIComponent(source.slice(comma + 1)));
    } else {
      const response = await session.fetch(source);
      if (!response.ok) return;
      buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > maxBytes) return;
      const mime = response.headers.get("content-type")?.split(";")[0].trim();
      original = `data:${mime?.startsWith("image/") ? mime : "image/x-icon"};base64,${buffer.toString("base64")}`;
    }
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return original;
    const dataUrl = image.resize({ width: 32 }).toDataURL();
    return dataUrl.startsWith("data:image/") ? dataUrl : undefined;
  } catch {
    return;
  }
}
