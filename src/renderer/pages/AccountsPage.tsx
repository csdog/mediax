import { AccountManagement } from "@/components/AccountManagement";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useWorkspace } from "@/app/WorkspaceContext";

export function AccountsPage() {
  const {
    accounts,
    busy,
    setPlatform,
    setName,
    setAccountDialogOpen,
    run,
    openBrowser,
    setAccounts,
    setNotice,
    removeAccount,
  } = useWorkspace();
  return (
    <DocumentPage>
      <AccountManagement
        accounts={accounts}
        busy={busy}
        onAuthorize={() => {
          setPlatform(null);
          setName("");
          setAccountDialogOpen(true);
        }}
        onOpen={(account) => void run(() => openBrowser(account))}
        onRefresh={(ids) =>
          void (async () => {
            try {
              for (const id of ids) {
                const updated = await window.desktop.refreshAccount(id);
                setAccounts((old) => old.map((a) => (a.id === id ? updated : a)));
              }
            } catch (error) {
              setNotice(error instanceof Error ? error.message : String(error));
            }
          })()
        }
        onDelete={(account) => void run(() => removeAccount(account.id))}
      />
    </DocumentPage>
  );
}
