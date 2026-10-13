import type React from "react";
import { Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceDialogs } from "@/components/dialogs/WorkspaceDialogs";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { NewTabPage } from "@/pages/NewTabPage";
import { BrowserPage } from "@/pages/BrowserPage";
import { useWorkspace } from "@/app/WorkspaceContext";

export function WorkspaceShell() {
  const { sidebarOpen, setSidebarOpen, setAvatarMenuOpen, settingsOpen, isNewTab, activeBrowser } =
    useWorkspace();
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
          {!settingsOpen &&
            (isNewTab ? <NewTabPage /> : activeBrowser ? <BrowserPage /> : <Outlet />)}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
