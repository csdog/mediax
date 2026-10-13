import { describe, expect, it, vi } from "vitest";
import { scheduleAfterFirstPaint } from "../../src/main/desktop/startupIdle";

describe("scheduleAfterFirstPaint", () => {
  it("runs immediately when the main frame is not loading", () => {
    vi.useFakeTimers();
    const work = vi.fn();
    const once = vi.fn();
    scheduleAfterFirstPaint(
      {
        webContents: {
          isLoadingMainFrame: () => false,
          once,
        },
      } as unknown as Electron.BrowserWindow,
      work,
    );
    expect(once).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("waits for did-finish-load while the main frame is loading", () => {
    vi.useFakeTimers();
    const work = vi.fn();
    let finish: (() => void) | undefined;
    scheduleAfterFirstPaint(
      {
        webContents: {
          isLoadingMainFrame: () => true,
          once: (_event: string, handler: () => void) => {
            finish = handler;
          },
        },
      } as unknown as Electron.BrowserWindow,
      work,
    );
    expect(work).not.toHaveBeenCalled();
    finish?.();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
