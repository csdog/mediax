import { nativeTheme, type BrowserWindow } from "electron";

export type WindowBackdrop = {
  endStartup: () => void;
};

/** Keep native chrome colors in sync with the active light/dark appearance. */
export function installWindowBackdrop(window: BrowserWindow): WindowBackdrop {
  let startup = true;
  const update = () => {
    if (window.isDestroyed()) return;
    const dark = nativeTheme.shouldUseDarkColors;
    const material =
      process.platform === "darwin" &&
      !nativeTheme.prefersReducedTransparency &&
      (startup || window.isFocused());
    // Switch the native backdrop, rather than fading the entire web page or its text.
    window.setBackgroundColor(material ? "#00000000" : dark ? "#000000" : "#f9f9f9");
    if (process.platform === "darwin") window.setVibrancy(material ? "menu" : null);
  };
  window.on("focus", update);
  window.on("blur", update);
  window.on("show", update);
  window.on("hide", update);
  nativeTheme.on("updated", update);
  window.once("closed", () => nativeTheme.off("updated", update));
  update();
  return {
    endStartup() {
      if (!startup) return;
      startup = false;
      update();
    },
  };
}
