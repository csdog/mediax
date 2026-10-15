import { useEffect } from "react";
import { useSonner } from "sonner";

function toasterEl() {
  return document.querySelector<HTMLElement>("[data-sonner-toaster]");
}

function readToasts() {
  return [...document.querySelectorAll<HTMLElement>("[data-sonner-toast]")].map((toast) => {
    const title =
      toast.querySelector<HTMLElement>("[data-title]")?.textContent?.trim() ||
      toast.textContent?.trim() ||
      "";
    const description = toast.querySelector<HTMLElement>("[data-description]")?.textContent?.trim();
    return {
      type: toast.getAttribute("data-type") || "default",
      title: title.slice(0, 200),
      description: description ? description.slice(0, 200) : undefined,
    };
  });
}

/** Mirror Sonner into a child window while an account WebContentsView would cover the HTML toaster. */
export function useNativeToastOverlay(enabled: boolean) {
  const { toasts } = useSonner();
  const toastCount = toasts.length;
  useEffect(() => {
    const show = window.desktop.showToastOverlay;
    const hide = window.desktop.hideToastOverlay;
    if (!show || !hide) return;
    if (!enabled || toastCount <= 0) {
      void hide();
      return;
    }
    let frame = 0;
    let stopped = false;
    let published = "";
    const resize = new ResizeObserver(() => publish());
    const mutations = new MutationObserver(() => publish());
    const publish = () => {
      if (stopped) return;
      const host = toasterEl();
      const box = host?.getBoundingClientRect();
      const items = readToasts().filter((item) => item.title);
      if (!host || !box || box.width < 1 || !items.length) {
        void hide();
        published = "";
        return;
      }
      const payload = {
        x: box.x,
        y: box.y,
        width: box.width,
        // Sonner positions every toast absolutely, so its host can have zero height.
        // The native window measures its own content and anchors it at this bottom edge.
        height: Math.max(1, box.height),
        toasts: items.slice(0, 3),
      };
      const key = JSON.stringify(payload);
      if (key === published) return;
      published = key;
      void show(payload);
    };
    const watch = () => {
      if (stopped) return;
      const host = toasterEl();
      if (!host) {
        frame = requestAnimationFrame(watch);
        return;
      }
      resize.observe(host);
      mutations.observe(host, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      publish();
    };
    watch();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      void hide();
    };
  }, [enabled, toastCount]);
}
