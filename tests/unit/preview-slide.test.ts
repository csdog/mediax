import { expect, it } from "vitest";
import { slidePreviewRect } from "../../src/main/desktop/preview-slide";

it("moves the preview from the previous tab toward the next one", () => {
  expect(
    slidePreviewRect(
      { x: 100, y: 40, width: 288, height: 250 },
      { x: 400, y: 40, width: 288, height: 260 },
      0,
    ),
  ).toEqual({ x: 100, y: 40, width: 288, height: 250 });
  const mid = slidePreviewRect(
    { x: 100, y: 40, width: 288, height: 250 },
    { x: 400, y: 40, width: 288, height: 260 },
    1,
  );
  expect(mid).toEqual({ x: 400, y: 40, width: 288, height: 260 });
  const between = slidePreviewRect(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 100, y: 0, width: 100, height: 100 },
    0.5,
  );
  expect(between.x).toBeGreaterThan(0);
  expect(between.x).toBeLessThan(100);
});
