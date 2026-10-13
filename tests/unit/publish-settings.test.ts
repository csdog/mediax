import { it, expect } from "vitest";
import {
  bandwidthLimitBytesPerSecond,
  clampConcurrency,
  mergePublishSettings,
  readPublishSettings,
} from "../../src/shared/publishSettings";

it("clamps concurrency to at least 1 without an upper bound", () => {
  expect(clampConcurrency(0)).toBe(1);
  expect(clampConcurrency(3.9)).toBe(3);
  expect(clampConcurrency(99)).toBe(99);
});

it("reads and merges publish settings from storage", () => {
  const values = new Map<string, unknown>([
    ["silentPublish", true],
    ["publishConcurrency", 5],
    ["publishBandwidthLimitKbps", 2048],
  ]);
  expect(readPublishSettings((key) => values.get(key))).toEqual({
    silent: true,
    concurrency: 5,
    bandwidthLimitKbps: 2048,
  });
  expect(
    mergePublishSettings(
      readPublishSettings((key) => values.get(key)),
      {
        concurrency: 1,
        bandwidthLimitKbps: 0,
      },
    ),
  ).toEqual({ silent: true, concurrency: 1, bandwidthLimitKbps: 0 });
});

it("converts kbps limits to Chromium bytes/second", () => {
  expect(bandwidthLimitBytesPerSecond(0)).toBe(0);
  expect(bandwidthLimitBytesPerSecond(1000)).toBe(125000);
});
