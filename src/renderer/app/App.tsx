import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createQueryClient } from "./queries";
import { createWorkspaceRouter } from "./router";
export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createWorkspaceRouter);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
