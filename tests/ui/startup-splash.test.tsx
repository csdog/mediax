// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { dismissStartupSplash } from "../../src/renderer/lib/startupSplash";

describe("dismissStartupSplash", () => {
  it("fades out and removes the splash node", () => {
    document.body.innerHTML =
      '<div id="mediax-startup-splash"><img alt="" /></div><div id="root"></div>';
    const splash = document.getElementById("mediax-startup-splash")!;
    vi.useFakeTimers();
    dismissStartupSplash();
    expect(splash.classList.contains("mediax-startup-splash--hide")).toBe(true);
    vi.runAllTimers();
    expect(document.getElementById("mediax-startup-splash")).toBeNull();
    vi.useRealTimers();
  });
});
