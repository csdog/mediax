export type Rect = { x: number; y: number; width: number; height: number };

// Box shadows sit outside the popup rect; keep the native page below them.
const SHADOW = 12;

// WebContentsView paints above the renderer, so a popup that overlaps the page is covered.
// The view is one rectangle: start it under the lowest overlapping popup.
export function browserBoundsAvoidingOverlays(pane: Rect, overlays: Rect[]): Rect {
  const paneRight = pane.x + pane.width;
  const paneBottom = pane.y + pane.height;
  let cover = pane.y;
  for (const overlay of overlays) {
    if (overlay.width < 1 || overlay.height < 1) continue;
    const right = overlay.x + overlay.width;
    const bottom = overlay.y + overlay.height;
    if (overlay.x >= paneRight || right <= pane.x) continue;
    if (overlay.y >= paneBottom || bottom <= pane.y) continue;
    cover = Math.max(cover, bottom);
  }
  if (cover <= pane.y) return pane;
  const y = Math.min(paneBottom, Math.ceil(cover + SHADOW));
  return { x: pane.x, y, width: pane.width, height: Math.max(0, paneBottom - y) };
}
