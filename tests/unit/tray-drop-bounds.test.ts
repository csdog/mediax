import { expect, it } from "vitest";
import { trayDropBounds } from "../../src/main/desktop/trayDropBounds";

const workArea = { x: 0, y: 0, width: 1440, height: 900 };

it("anchors a short lane under a top menu-bar tray icon", () => {
  const bounds = trayDropBounds({ x: 1200, y: 0, width: 36, height: 24 }, workArea, false);
  expect(bounds.height).toBe(18);
  expect(bounds.y).toBe(34);
  expect(bounds.x + bounds.width / 2).toBeCloseTo(1218, 0);
});

it("grows a wide card from the same tray anchor", () => {
  const lane = trayDropBounds({ x: 1200, y: 0, width: 36, height: 24 }, workArea, false);
  const card = trayDropBounds({ x: 1200, y: 0, width: 36, height: 24 }, workArea, true);
  expect(card.width).toBeGreaterThan(lane.width);
  expect(card.height).toBeGreaterThan(lane.height);
  expect(card.y).toBe(lane.y);
});

it("places the card above a bottom taskbar tray", () => {
  const bounds = trayDropBounds({ x: 1100, y: 860, width: 40, height: 40 }, workArea, true);
  expect(bounds.y).toBeLessThan(860);
});
