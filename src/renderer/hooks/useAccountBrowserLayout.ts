import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { TabPreview } from "./useTabPreview";
type Options = {
  activeBrowser: string | null;
  settingsOpen: boolean;
  accountDialogOpen: boolean;
  avatarMenuOpen: boolean;
  hoveredTab: string | null;
  tabPreview: TabPreview | null;
  setNotice: (notice: string) => void;
};
// Electron WebContentsViews render outside React; keep their native bounds and overlays in sync.
export function useAccountBrowserLayout({
  activeBrowser,
  settingsOpen,
  accountDialogOpen,
  avatarMenuOpen,
  hoveredTab,
  tabPreview,
  setNotice,
}: Options) {
  const browserPane = useRef<HTMLDivElement>(null);
  const [overlayCover, setOverlayCover] = useState<{ id: string; image: string } | null>(null);
  const previewVisible = Boolean(hoveredTab && tabPreview?.id === hoveredTab);
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
        if (settingsOpen || !activeBrowser || !rect) {
          await window.desktop.layoutAccountBrowser(null);
          if (current === revision) setOverlayCover(null);
          return;
        }
        const overlapping = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-slot="popover-content"]:not([data-avatar-menu]), [data-slot="hover-card-content"], [data-slot="dialog-content"]',
          ),
        ].some((element) => {
          if (element.dataset.state === "closed") return false;
          const overlay = element.getBoundingClientRect();
          return (
            overlay.width > 0 &&
            overlay.height > 0 &&
            overlay.left < rect.right &&
            overlay.right > rect.left &&
            overlay.top < rect.bottom &&
            overlay.bottom > rect.top
          );
        });
        if (overlapping) {
          const image =
            previewVisible && tabPreview?.cover
              ? tabPreview.cover
              : (await window.desktop.previewAccountBrowser(activeBrowser)).image;
          if (current !== revision) return;
          if (image) {
            // Keep the page visible before hiding the native view beneath a renderer overlay.
            flushSync(() => setOverlayCover({ id: activeBrowser, image }));
            await window.desktop.layoutAccountBrowser(null);
            return;
          }
        }
        if (current !== revision) return;
        await window.desktop.layoutAccountBrowser(activeBrowser, bounds);
        if (current === revision) setOverlayCover(null);
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
  }, [activeBrowser, settingsOpen, accountDialogOpen, avatarMenuOpen, hoveredTab, previewVisible]);
  return { browserPane, overlayCover };
}
