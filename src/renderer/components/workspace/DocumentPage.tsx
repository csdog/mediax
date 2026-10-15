import type { ReactNode } from "react";
import { cn } from "cn";
import { useWorkspace } from "@/app/WorkspaceContext";
export function DocumentPage({ children }: { children: ReactNode }) {
  const { page, pageTitle } = useWorkspace();
  return (
    <main
      className={cn(
        "document-content",
        (page === "compose" || page === "video") && "compose-content",
        page === "accounts" && "accounts-content",
      )}
    >
      <h1 className="sr-only">{pageTitle}</h1>
      {children}
    </main>
  );
}
