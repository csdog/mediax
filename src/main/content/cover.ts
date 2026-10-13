import { nativeImage } from "electron";

export function coverDataUrl(path: string | undefined): string | null {
  if (!path) return null;
  try {
    const image = nativeImage.createFromPath(path);
    if (image.isEmpty()) return null;
    return image.resize({ width: 160, quality: "good" }).toDataURL();
  } catch {
    return null;
  }
}
