import { useEffect } from "react";

function openTooltip() {
  return document.querySelector<HTMLElement>('[data-slot="tooltip-content"][data-open]');
}

function clearMirrored() {
  for (const tip of document.querySelectorAll(
    '[data-slot="tooltip-content"][data-native-mirrored]',
  ))
    tip.removeAttribute("data-native-mirrored");
}

/** Mirror HTML tooltips into a native view while an external page would cover them. */
export function useNativeTooltipOverlay(enabled: boolean) {
  useEffect(() => {
    const show = window.desktop.showTooltipOverlay;
    const hide = window.desktop.hideTooltipOverlay;
    if (!show || !hide) return;
    if (!enabled) {
      clearMirrored();
      void hide();
      return;
    }
    let stopped = false;
    let published = "";
    const resize = new ResizeObserver(() => publish());
    const publish = () => {
      if (stopped) return;
      const tip = openTooltip();
      const box = tip?.getBoundingClientRect();
      const text = tip?.textContent?.trim() ?? "";
      if (!tip || !box || box.width < 1 || box.height < 1 || !text) {
        if (!published) return;
        published = "";
        clearMirrored();
        void hide();
        return;
      }
      resize.observe(tip);
      const style = getComputedStyle(tip);
      const payload = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: text.slice(0, 200),
        background: style.backgroundColor,
        color: style.color,
        radius: style.borderRadius || "12px",
      };
      const key = JSON.stringify(payload);
      if (key === published) return;
      published = key;
      void show(payload)
        .then(() => {
          if (!stopped && tip.isConnected) tip.setAttribute("data-native-mirrored", "");
        })
        .catch(() => {
          published = "";
          tip.removeAttribute("data-native-mirrored");
        });
    };
    const mutations = new MutationObserver(publish);
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-open", "data-closed"],
    });
    publish();
    return () => {
      stopped = true;
      resize.disconnect();
      mutations.disconnect();
      clearMirrored();
      void hide();
    };
  }, [enabled]);
}
