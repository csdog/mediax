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
    const update = async () => {
      const current = ++revision;
      const rect = pane?.getBoundingClientRect();
      const bounds = rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined;
      try {
        if (settingsOpen || concealBrowser || !activeBrowser || !rect) {
          await window.desktop.layoutAccountBrowser(null);
          return;
        }
        if (current !== revision) return;
        await window.desktop.layoutAccountBrowser(activeBrowser, bounds);
      } catch (error) {
        if (current === revision) setNotice(String(error));
      }
    };
    void update();
    const observer = pane ? new ResizeObserver(() => void update()) : null;
    if (pane) observer?.observe(pane);
    const resize = () => void update();
    window.addEventListener("resize", resize);
    return () => {
      revision++;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [activeBrowser, settingsOpen, concealBrowser, setNotice]);
  return { browserPane };
}
