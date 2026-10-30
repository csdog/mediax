import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { AppToaster } from "@/components/AppToaster";
import { initializeRendererLogging } from "@/lib/logging";
import { installSystemTheme } from "@/lib/systemTheme";
import "../style.css";

/** Demo HTML entries are served by Vite locally and are excluded from production inputs. */
export function mountDemo(page: ReactNode) {
  if (!import.meta.env.DEV) return;
  initializeRendererLogging();
  installSystemTheme();
  document.documentElement.dataset.desktopPlatform = window.desktopPlatform ?? "browser";
  document.documentElement.dataset.localDemos = "__MEDIAX_LOCAL_DEMOS__";
  void window.desktop?.hideToastOverlay?.();
  const root = document.getElementById("root");
  if (root)
    createRoot(root).render(
      <>
        {page}
        {window.desktop?.showToastOverlay && <AppToaster />}
      </>,
    );
}
