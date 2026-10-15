const LABEL_CLASS = "mediax-current-time-label";

type Options = {
  timeZone: string;
  locale?: string;
};

/** Keep a now-time badge on the week/day time axis aligned with Schedule-X's indicator. */
export function attachCurrentTimeAxisLabel(root: HTMLElement, options: Options): () => void {
  const formatTime = () =>
    new Intl.DateTimeFormat(options.locale ?? "zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: options.timeZone,
    }).format(new Date());

  const sync = () => {
    const indicator = root.querySelector<HTMLElement>(".sx__current-time-indicator");
    const weekGrid = root.querySelector<HTMLElement>(".sx__week-grid");
    let label = root.querySelector<HTMLElement>(`.${LABEL_CLASS}`);

    if (!indicator || !weekGrid) {
      label?.remove();
      return;
    }

    if (!label || label.parentElement !== weekGrid) {
      label?.remove();
      label = document.createElement("div");
      label.className = LABEL_CLASS;
      label.setAttribute("aria-hidden", "true");
      weekGrid.appendChild(label);
    }

    const top = indicator.style.top;
    if (label.style.top !== top) label.style.top = top;
    const text = formatTime();
    if (label.textContent !== text) label.textContent = text;
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  sync();
  const intervalId = window.setInterval(sync, 15_000);

  return () => {
    observer.disconnect();
    window.clearInterval(intervalId);
    root.querySelector(`.${LABEL_CLASS}`)?.remove();
  };
}
