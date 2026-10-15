import { expect, it } from "vitest";
import { browserBoundsAvoidingOverlays } from "../../src/renderer/lib/browserOverlayBounds";

const pane = { x: 80, y: 96, width: 900, height: 600 };

it("keeps the page when nothing overlaps it", () => {
  const menu = { x: 20, y: 40, width: 40, height: 40 };
  expect(browserBoundsAvoidingOverlays(pane, [menu])).toEqual(pane);
});

it("starts the page below a download panel", () => {
  const downloads = { x: 700, y: 88, width: 320, height: 280 };
  const bounds = browserBoundsAvoidingOverlays(pane, [downloads]);
  expect(bounds.x).toBe(pane.x);
  expect(bounds.width).toBe(pane.width);
  expect(bounds.y).toBeGreaterThanOrEqual(368);
  expect(bounds.y + bounds.height).toBe(pane.y + pane.height);
});

it("uses the lower of two overlapping popups", () => {
  const extensions = { x: 640, y: 88, width: 288, height: 120 };
  const downloads = { x: 700, y: 88, width: 320, height: 280 };
  const bounds = browserBoundsAvoidingOverlays(pane, [extensions, downloads]);
  expect(bounds.y).toBeGreaterThanOrEqual(368);
});
