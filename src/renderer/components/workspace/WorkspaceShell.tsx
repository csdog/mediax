import type React from "react";
import { Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceDialogs } from "@/components/dialogs/WorkspaceDialogs";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { BrowserChrome } from "./BrowserChrome";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { NewTabPage } from "@/pages/NewTabPage";
import { BrowserPage } from "@/pages/BrowserPage";
import { ComposePage } from "@/pages/ComposePage";
import { useWorkspace } from "@/app/WorkspaceContext";
import { useNativeTooltipOverlay } from "@/hooks/useNativeTooltipOverlay";

export function WorkspaceShell() {
  const {
    sidebarOpen,
    setSidebarOpen,
    setAvatarMenuOpen,
    settingsOpen,
    isNewTab,
    isPageTab,
    isComposeTab,
    activeBrowser,
    activeBrowserViewId,
    concealBrowser,
  } = useWorkspace();
  const showBrowserChrome = Boolean(activeBrowserViewId) || isNewTab;
  const mirrorNativeChrome = Boolean(activeBrowserViewId) && !concealBrowser && !settingsOpen;
  useNativeTooltipOverlay(mirrorNativeChrome);
  return (
    <TooltipProvider>
      <WorkspaceDialogs />
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open);
          if (!open) setAvatarMenuOpen(false);
        }}
        className={`workspace ${settingsOpen ? "settings-active" : ""}`}
        style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      >
        <WorkspaceToolbar />
        {settingsOpen && <Outlet />}
        <WorkspaceNavigation />
        <SidebarInset className="min-w-0 bg-background">
          {!settingsOpen && (
            <>
              {showBrowserChrome ? <BrowserChrome key={activeBrowser ?? "new-tab"} /> : null}
              <div className="workspace-main">
                {isComposeTab ? (
                  <ComposePage />
                ) : isNewTab ? (
                  <NewTabPage />
                ) : isPageTab || !activeBrowser ? (
                  <Outlet />
                ) : (
                  <BrowserPage />
                )}
              </div>
            </>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
