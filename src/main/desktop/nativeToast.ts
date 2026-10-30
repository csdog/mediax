import type { NativeToastEvent, ToastOverlay, ToastOverlayItem } from "../../shared/models";

// Serialized into the sandboxed native view. Keep all runtime helpers inside this function.
export function installNativeToasts(notify: (event: NativeToastEvent) => void) {
  const host = document.querySelector<HTMLElement>("[data-native-toaster]")!;
  const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
  type Entry = {
    data: ToastOverlayItem;
    node: HTMLElement;
    remaining: number | null;
    started: number;
    timer?: ReturnType<typeof setTimeout>;
    leaving: boolean;
    visible: boolean;
  };
  const entries = new Map<string | number, Entry>();
  let order: (string | number)[] = [];
  let expanded = false;
  let hovering = false;
  let focused = false;
  let reportedHeight = 0;
  let shrink: ReturnType<typeof setTimeout> | undefined;
  let closeIcon = "";
  let maxHeight = 600;

  const pause = (entry: Entry) => {
    if (entry.timer !== undefined) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
      if (entry.remaining !== null)
        entry.remaining = Math.max(0, entry.remaining - (performance.now() - entry.started));
    }
  };
  const start = (entry: Entry) => {
    if (
      expanded ||
      !entry.visible ||
      entry.leaving ||
      entry.remaining === null ||
      entry.timer !== undefined
    )
      return;
    entry.started = performance.now();
    entry.timer = setTimeout(() => dismiss(entry, "timeout"), entry.remaining);
  };
  const report = (height: number) => {
    const next = Math.ceil(height);
    if (next === reportedHeight) return;
    reportedHeight = next;
    host.style.height = next + "px";
    notify({ type: "resize", height: next + 24 });
  };
  const layout = () => {
    clearTimeout(shrink);
    const visible = order
      .map((id) => entries.get(id))
      .filter((entry): entry is Entry => Boolean(entry && !entry.leaving))
      .slice(0, 3);
    const copyHeight = Math.max(
      24,
      Math.min(
        180,
        Math.floor(
          (maxHeight - 24 - Math.max(0, visible.length - 1) * 10) / Math.max(1, visible.length),
        ) - 30,
      ),
    );
    host.style.setProperty("--copy-max-height", copyHeight + "px");
    for (const entry of visible) {
      entry.node.hidden = false;
      entry.node.style.height = "";
    }
    const naturalHeights = visible.map((entry) => entry.node.offsetHeight);
    let offset = 0;
    const frontHeight = naturalHeights[0] ?? 0;
    for (const entry of entries.values()) {
      entry.visible = visible.includes(entry);
      if (!entry.visible && !entry.leaving) {
        entry.node.hidden = true;
        pause(entry);
      }
    }
    visible.forEach((entry, index) => {
      entry.node.hidden = false;
      entry.node.dataset.front = String(index === 0);
      entry.node.style.height = (expanded ? naturalHeights[index] : frontHeight) + "px";
      entry.node.style.zIndex = String(100 - index);
      entry.node.style.setProperty("--offset", (expanded ? offset : index * 12) + "px");
      entry.node.style.setProperty("--scale", String(expanded ? 1 : 1 - index * 0.05));
      offset += naturalHeights[index] + 10;
      start(entry);
    });
    const desired = visible.length
      ? expanded
        ? offset - 10
        : Math.max(
            frontHeight,
            ...visible.map(
              (entry, index) => entry.node.offsetHeight * (1 - index * 0.05) + index * 12,
            ),
          )
      : 0;
    // Grow before animating; shrink only after exiting/repositioning cards have settled.
    report(Math.max(reportedHeight, desired));
    shrink = setTimeout(() => {
      report(desired);
      if (!entries.size) {
        hovering = false;
        focused = false;
        expanded = false;
        host.dataset.expanded = "false";
        notify({ type: "empty" });
      }
    }, motion);
  };
  const setExpanded = () => {
    const next = hovering || focused;
    if (expanded === next) return;
    expanded = next;
    host.dataset.expanded = String(expanded);
    for (const entry of entries.values()) pause(entry);
    layout();
  };
  const dismiss = (entry: Entry, reason?: "timeout" | "close") => {
    if (entry.leaving || (reason === "close" && entry.data.dismissible === false)) return;
    pause(entry);
    entry.leaving = true;
    entry.node.dataset.phase = "leaving";
    if (reason) notify({ type: "dismiss", id: entry.data.id, reason });
    setTimeout(() => {
      observer.unobserve(entry.node);
      entry.node.remove();
      entries.delete(entry.data.id);
      layout();
    }, motion);
    layout();
  };
  const observer = new ResizeObserver(() => layout());
  host.addEventListener("pointerenter", () => {
    hovering = true;
    setExpanded();
  });
  host.addEventListener("pointerleave", () => {
    hovering = false;
    setExpanded();
  });
  host.addEventListener("focusin", () => {
    focused = true;
    setExpanded();
  });
  host.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
    focused = false;
    setExpanded();
  });
  host.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const front = order
      .map((id) => entries.get(id))
      .find((entry) => entry && !entry.leaving && entry.data.dismissible !== false);
    if (front) dismiss(front, "close");
  });
  addEventListener("resize", layout);

  return (data: ToastOverlay) => {
    maxHeight = data.maxHeight ?? 600;
    host.dataset.sonnerTheme = data.theme ?? "light";
    host.style.width = data.width + "px";
    closeIcon = data.closeIcon ?? "";
    order = data.toasts.map((item) => item.id);
    for (const [id, entry] of entries) if (!order.includes(id)) dismiss(entry);
    for (const item of data.toasts) {
      let entry = entries.get(item.id);
      if (entry?.leaving) continue;
      if (!entry) {
        const node = document.createElement("section");
        node.className = "native-toast";
        node.dataset.phase = "entering";
        node.setAttribute("role", item.type === "error" ? "alert" : "status");
        node.innerHTML =
          '<span data-native-toast-icon aria-hidden="true"></span><div class="copy"><p class="title"></p><p class="description"></p></div><button type="button" class="close" aria-label="关闭提示"><span data-native-toast-icon aria-hidden="true"></span></button>';
        entry = {
          data: item,
          node,
          remaining: item.duration,
          started: 0,
          leaving: false,
          visible: false,
        };
        const current = entry;
        node.querySelector("button")!.addEventListener("click", () => dismiss(current, "close"));
        entries.set(item.id, entry);
        host.append(node);
        observer.observe(node);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!current.leaving) current.node.dataset.phase = "visible";
          }),
        );
      } else if (
        entry.data.type !== item.type ||
        entry.data.title !== item.title ||
        entry.data.duration !== item.duration
      ) {
        pause(entry);
        entry.remaining = item.duration;
      }
      entry.data = item;
      entry.node.dataset.type = item.type;
      entry.node.querySelector(".title")!.textContent = item.title;
      const description = entry.node.querySelector<HTMLElement>(".description")!;
      description.textContent = item.description ?? "";
      description.hidden = !item.description;
      const icon = entry.node.querySelector<HTMLElement>("[data-native-toast-icon]")!;
      icon.hidden = !item.icon;
      icon.style.maskImage = item.icon ? `url("${item.icon}")` : "none";
      const close = entry.node.querySelector<HTMLButtonElement>("button")!;
      close.hidden = item.dismissible === false;
      close.querySelector<HTMLElement>("span")!.style.maskImage = closeIcon
        ? `url("${closeIcon}")`
        : "none";
    }
    layout();
  };
}
