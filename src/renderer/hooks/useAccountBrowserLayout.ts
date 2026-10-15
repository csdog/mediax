import { userErrorMessage } from "../../shared/userError";
import { browserBoundsAvoidingOverlays } from "@/lib/browserOverlayBounds";
import { useEffect, useRef } from "react";

const OVERLAYS = '[data-slot="popover-content"], [data-slot="dropdown-menu-content"]';

function openOverlayRects() {
  const rects = [];
  for (const node of document.querySelectorAll(OVERLAYS)) {
    if (!(node instanceof HTMLElement) || node.hidden) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const host = node.parentElement instanceof HTMLElement ? node.parentElement : node;
    const rect = host.getBoundingClientRect();
    rects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }
  return rects;
}

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
          ? browserBoundsAvoidingOverlays(
              { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              openOverlayRects(),
            )
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
        if (current === revision) setNotice(userErrorMessage(error));
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
    const overlays = new MutationObserver(schedule);
    overlays.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "hidden", "data-open", "data-closed"],
    });
    window.addEventListener("resize", schedule);
    return () => {
      revision++;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      overlays.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [activeBrowser, settingsOpen, concealBrowser, setNotice]);
  return { browserPane };
}
