import type { ReactNode } from "react";
import { useWorkspace } from "@/app/WorkspaceContext";
export function DocumentPage({ children }: { children: ReactNode }) {
  const { page, pageTitle } = useWorkspace();
  return (
    <main
      className={`document-content ${page === "compose" || page === "video" ? "compose-content" : page === "accounts" ? "accounts-content" : page === "history" ? "history-content" : ""}`}
    >
      <h1 className="sr-only">{pageTitle}</h1>
      {children}
    </main>
  );
}
