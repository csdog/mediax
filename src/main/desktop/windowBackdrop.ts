import { nativeTheme, type BrowserWindow } from "electron";

/** Follow the OS appearance so native chrome matches renderer light/dark tokens. */
export function installWindowBackdrop(window: BrowserWindow) {
  nativeTheme.themeSource = "system";
  const update = () => {
    if (window.isDestroyed()) return;
    const dark = nativeTheme.shouldUseDarkColors;
    const material =
      process.platform === "darwin" &&
      window.isFocused() &&
      !nativeTheme.prefersReducedTransparency;
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
}
