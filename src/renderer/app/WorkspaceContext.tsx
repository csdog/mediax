import { createContext, useContext, type ReactNode } from "react";
import { useWorkspaceController } from "@/hooks/useWorkspaceController";
const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceController> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceController();
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  return workspace;
}
