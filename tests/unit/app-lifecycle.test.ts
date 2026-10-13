import { describe, expect, it, vi } from "vitest";
import { AppLifecycle } from "../../src/main/desktop/appLifecycle";

describe("AppLifecycle", () => {
  it("runs Eventually work after restored delay", () => {
    vi.useFakeTimers();
    const lifecycle = new AppLifecycle();
    const work = vi.fn();
    lifecycle.whenEventually(work);
    expect(lifecycle.current).toBe("starting");
    lifecycle.markRestored();
    expect(lifecycle.current).toBe("restored");
    expect(work).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_500);
    expect(lifecycle.current).toBe("eventually");
    expect(work).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("runs work immediately when already in Eventually", () => {
    vi.useFakeTimers();
    const lifecycle = new AppLifecycle();
    lifecycle.markRestored();
    vi.advanceTimersByTime(2_500);
    const work = vi.fn();
    lifecycle.whenEventually(work);
    expect(work).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
