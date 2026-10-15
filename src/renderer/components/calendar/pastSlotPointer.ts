const PAST_SLOT_SELECTOR = [
  '.sx__time-grid-background-event[title="过去"]',
  '.sx__month-grid-background-event[title="过去"]',
  '.sx__date-grid-background-event[title="过去"]',
].join(", ");

/** Past gray slots capture pointer with a disabled cursor and block create-click. */
export function attachPastSlotPointerGuard(root: HTMLElement) {
  const block = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(PAST_SLOT_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const types = ["click", "mousedown", "dblclick", "touchstart", "pointerdown"] as const;
  for (const type of types) {
    root.addEventListener(type, block, true);
  }

  return () => {
    for (const type of types) {
      root.removeEventListener(type, block, true);
    }
  };
}
