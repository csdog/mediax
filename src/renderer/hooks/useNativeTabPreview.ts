import { useEffect } from "react";

function openPreviewCard(tabId: string) {
  return document.querySelector<HTMLElement>(
    `[data-slot="hover-card-content"][data-preview-tab="${CSS.escape(tabId)}"]:not([data-closed])`,
  );
}

// Keep the child window across tab changes so it can slide to the next preview.
export function useNativeTabPreview(tabId: string | null) {
  useEffect(() => {
    const show = window.desktop.showTabPreview;
    const hide = window.desktop.hideTabPreview;
    if (!show || !hide) return;
    if (!tabId) {
      void hide();
      return;
    }
    let frame = 0;
    let stopped = false;
    let published = "";
    const publish = () => {
      if (stopped) return;
      const card = openPreviewCard(tabId);
      const box = card?.getBoundingClientRect();
      if (!card || !box || box.width < 1 || box.height < 1) return;
      const image = card.querySelector("img");
      const payload = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        label: card.getAttribute("aria-label") ?? "页面预览",
        lines: [...card.querySelectorAll("p")]
          .map((paragraph) => paragraph.textContent?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 4),
        image: image?.src || null,
        alt: image?.alt ?? "",
        placeholder: Boolean(card.querySelector(".tab-preview-placeholder")),
      };
      const key = JSON.stringify(payload);
      if (key === published) return;
      published = key;
      void show(payload);
    };
    const watch = () => {
      if (stopped) return;
      const card = openPreviewCard(tabId);
      if (!card) {
        frame = requestAnimationFrame(watch);
        return;
      }
      publish();
      resize.observe(card);
      mutations.observe(card, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    };
    const resize = new ResizeObserver(publish);
    const mutations = new MutationObserver(publish);
    watch();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [tabId]);

  useEffect(() => () => void window.desktop.hideTabPreview?.(), []);
}
