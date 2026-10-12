import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkspace } from "@/app/WorkspaceContext";
export function DocumentPage({ children }: { children: ReactNode }) {
  const { page, pageTitle, notice } = useWorkspace();
  return (
    <main
      className={`document-content ${page === "compose" ? "compose-content" : page === "accounts" ? "accounts-content" : ""}`}
    >
      <h1 className="sr-only">{pageTitle}</h1>
      {notice && (
        <Alert role="status">
          <CircleHelp />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {children}
    </main>
  );
}
