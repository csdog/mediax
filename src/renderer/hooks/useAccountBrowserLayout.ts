import { userErrorMessage } from "../../shared/userError";
import { useEffect, useRef } from "react";

type Options = {
  activeBrowser: string | null;
  settingsOpen: boolean;
  concealBrowser: boolean;
  setNotice: (notice: string) => void;
};

// Electron WebContentsViews render outside React; keep their native bounds in sync with the pane.
export function useAccountBrowserLayout({
  activeBrowser,
  settingsOpen,
  concealBrowser,
  setNotice,
}: Options) {
  const browserPane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = browserPane.current;
    let revision = 0;
    let placed = "";
    const update = async () => {
      const current = ++revision;
      const rect = pane?.getBoundingClientRect();
      const hidden = settingsOpen || concealBrowser || !activeBrowser || !rect;
      const bounds =
        rect && !hidden
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : undefined;
      const next = bounds ? `${bounds.x},${bounds.y},${bounds.width},${bounds.height}` : "hidden";
      if (next === placed) return;
      try {
        if (!bounds || !activeBrowser) {
          await window.desktop.layoutAccountBrowser(null);
          if (current === revision) placed = next;
          return;
        }
        if (current !== revision) return;
        await window.desktop.layoutAccountBrowser(activeBrowser, bounds);
        if (current === revision) placed = next;
      } catch (error) {
        if (current !== revision) return;
        setNotice(userErrorMessage(error));
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void update());
    };
    void update();
    const observer = pane ? new ResizeObserver(schedule) : null;
    if (pane) observer?.observe(pane);
    window.addEventListener("resize", schedule);
    return () => {
      revision++;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [activeBrowser, settingsOpen, concealBrowser, setNotice]);
  return { browserPane };
}
