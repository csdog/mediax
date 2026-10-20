import { useLayoutEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AppToaster } from "@/components/AppToaster";
import { dismissStartupSplash } from "@/lib/startupSplash";
import { createQueryClient } from "./queries";
import { createWorkspaceRouter } from "./router";
export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createWorkspaceRouter);
  useLayoutEffect(() => {
    dismissStartupSplash();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AppToaster />
    </QueryClientProvider>
  );
}
