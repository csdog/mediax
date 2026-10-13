export type PreviewRect = { x: number; y: number; width: number; height: number };

export function slidePreviewRect(
  from: PreviewRect,
  to: PreviewRect,
  progress: number,
): PreviewRect {
  const t = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - t) ** 3;
  return {
    x: Math.round(from.x + (to.x - from.x) * eased),
    y: Math.round(from.y + (to.y - from.y) * eased),
    width: Math.round(from.width + (to.width - from.width) * eased),
    height: Math.round(from.height + (to.height - from.height) * eased),
  };
}
