import { useEffect, useRef } from "react";
import { toast, useSonner } from "sonner";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { ToastOverlayItem } from "../../shared/models";

const icons = Object.fromEntries(
  Object.entries({
    success: CircleCheck,
    info: Info,
    warning: TriangleAlert,
    error: CircleAlert,
    loading: LoaderCircle,
    close: X,
  }).map(([type, Icon]) => [
    type,
    "data:image/svg+xml," +
      encodeURIComponent(renderToStaticMarkup(createElement(Icon, { size: 20, color: "black" }))),
  ]),
);
function text(node: ReactNode | (() => ReactNode)): string {
  if (typeof node === "function") return text(node());
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return "";
}

/** Sonner is only the message bus. The native view owns rendering, interaction and timers. */
export function useNativeToastOverlay() {
  const { toasts } = useSonner();
  const current = useRef(toasts);
  current.current = toasts;
  const published = useRef(false);
  useEffect(
    () =>
      window.desktop.onNativeToastDismissed?.((event) => {
        const item = current.current.find((item) => item.id === event.id);
        if (!item) return;
        if (event.reason === "timeout") item.onAutoClose?.(item);
        else item.onDismiss?.(item);
        toast.dismiss(event.id);
      }),
    [],
  );
  useEffect(() => {
    const show = window.desktop.showToastOverlay;
    if (!show || (!toasts.length && !published.current)) return;
    const publish = () => {
      const width = Math.min(420, Math.max(1, innerWidth - 48));
      const items: ToastOverlayItem[] = current.current
        .filter((item) => !item.delete)
        .slice(0, 50)
        .map((item) => ({
          id: item.id,
          type: item.type ?? "default",
          title: text(item.title).slice(0, 200),
          description: text(item.description).slice(0, 200) || undefined,
          duration:
            item.type === "loading" || item.duration === Infinity
              ? null
              : Math.max(0, item.duration ?? 5000),
          dismissible: item.dismissible,
          icon: icons[item.type ?? "info"] ?? icons.info,
        }))
        .filter((item) => item.title);
      published.current = true;
      void show({
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        closeIcon: icons.close,
        x: (innerWidth - width) / 2,
        y: innerHeight - 25,
        width,
        height: 1,
        toasts: items,
      }).catch(() => {
        /* Keep message data in Sonner for the next update. */
      });
    };
    const observer = new MutationObserver(publish);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", publish);
    publish();
    return () => {
      observer.disconnect();
      removeEventListener("resize", publish);
    };
  }, [toasts]);
  useEffect(
    () => () => {
      void window.desktop.hideToastOverlay?.();
    },
    [],
  );
}
