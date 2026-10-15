import type { Rectangle } from "electron";

const LANE = { width: 168, height: 18 };
const CARD = { width: 420, height: 188 };

/** Keep the drop lane under the tray icon, and grow the card from that same anchor. */
export function trayDropBounds(tray: Rectangle, workArea: Rectangle, hot: boolean): Rectangle {
  const size = hot ? CARD : LANE;
  const gap = 10;
  const below = tray.y + tray.height + gap;
  const above = tray.y - gap - size.height;
  const fitsBelow = below + size.height <= workArea.y + workArea.height - 8;
  const y = fitsBelow || tray.y < workArea.y + workArea.height / 2 ? below : above;
  const center = tray.x + tray.width / 2;
  let x = Math.round(center - size.width / 2);
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - size.width - 8;
  x = Math.min(Math.max(x, minX), Math.max(minX, maxX));
  return { x, y: Math.round(y), width: size.width, height: size.height };
}
