const STARTUP_SPLASH_ID = "mediax-startup-splash";

export function dismissStartupSplash() {
  const splash = document.getElementById(STARTUP_SPLASH_ID);
  if (!splash) return;
  splash.classList.add("mediax-startup-splash--hide");
  const remove = () => splash.remove();
  splash.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 220);
}
