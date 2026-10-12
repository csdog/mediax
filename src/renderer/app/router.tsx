import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { WorkspaceProvider } from "./WorkspaceContext";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { AccountsPage } from "@/pages/AccountsPage";
import { ComposePage } from "@/pages/ComposePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { SettingsPage } from "@/pages/SettingsPage";
const rootRoute = createRootRoute({
  component: () => (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  ),
});
const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts",
  component: AccountsPage,
});
const composeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compose",
  component: ComposePage,
});
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([accountsRoute, composeRoute, historyRoute, settingsRoute]);
export function createWorkspaceRouter() {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/accounts"] }),
    defaultPendingMinMs: 0,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createWorkspaceRouter>;
  }
}
