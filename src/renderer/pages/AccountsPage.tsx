import { toast } from "sonner";
import { AccountManagement } from "@/components/AccountManagement";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useWorkspace } from "@/app/WorkspaceContext";
import { platformInfo } from "../../shared/platforms";
import type { PlatformId } from "../../shared/models";

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
    removeAccount,
    reload,
  } = useWorkspace();

  const authorizePlatform = (id: PlatformId) => {
    const label = platformInfo[id].label;
    void run(async () => {
      const account = await window.desktop.addAccount(
        `${label} 账号 ${accounts.filter((item) => item.platform === id).length + 1}`,
        id,
      );
      await reload();
      await openBrowser(account);
      toast("请在账号浏览器中完成登录，返回后点击「检查状态」。");
    });
  };

  return (
    <DocumentPage>
      <AccountManagement
        accounts={accounts}
        busy={busy}
        onAuthorize={(platformId) => {
          if (platformId) {
            authorizePlatform(platformId);
            return;
          }
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
              toast.error(error instanceof Error ? error.message : String(error));
            }
          })()
        }
        onDelete={(account) => void run(() => removeAccount(account.id))}
      />
    </DocumentPage>
  );
}
