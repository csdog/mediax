import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { WorkspaceProvider } from "./WorkspaceContext";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RouteError } from "@/components/RouteError";
import { AccountsPage } from "@/pages/AccountsPage";
import { ComposePage } from "@/pages/ComposePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SettingsPage } from "@/pages/SettingsPage";
const rootRoute = createRootRoute({
  component: () => (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  ),
  errorComponent: RouteError,
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
const videoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/video",
  component: ComposePage,
});
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  component: CalendarPage,
});
const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([
  accountsRoute,
  composeRoute,
  videoRoute,
  historyRoute,
  calendarRoute,
  analyticsRoute,
  settingsRoute,
]);
export function createWorkspaceRouter() {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/accounts"] }),
    defaultPendingMinMs: 0,
    defaultErrorComponent: RouteError,
    defaultOnCatch: (error, errorInfo) => {
      console.error("Route render failed", error, errorInfo);
    },
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createWorkspaceRouter>;
  }
}
