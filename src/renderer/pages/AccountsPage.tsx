import { toast } from "sonner";
import { userErrorMessage } from "../../shared/userError";
import { AccountManagement } from "@/components/AccountManagement";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useWorkspace } from "@/app/WorkspaceContext";
import { platformInfo } from "../../shared/platforms";
import type { AccountInfo, PlatformId } from "../../shared/models";

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
      toast.info("请在账号浏览器中完成登录，登录后会自动识别。");
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
        onRefresh={async (ids) => {
          try {
            const results: AccountInfo[] = [];
            for (const id of ids) {
              const updated = await window.desktop.refreshAccount(id);
              setAccounts((old) => old.map((a) => (a.id === id ? updated : a)));
              results.push(updated);
            }
            if (results.length === 1) {
              const updated = results[0];
              const labels = {
                logged_in: "已登录",
                logged_out: "未登录",
                unchecked: "待检查",
                needs_verification: "需要验证",
              };
              const notify =
                updated.login === "logged_in" && !updated.message?.startsWith("身份检查失败")
                  ? toast.success
                  : toast.warning;
              notify(
                [
                  `${updated.name}：${labels[updated.login]}`,
                  updated.message &&
                    userErrorMessage(updated.message, "身份检查未完成，请稍后重试。"),
                ]
                  .filter(Boolean)
                  .join("，"),
              );
            } else if (results.length > 1) {
              const loggedIn = results.filter((account) => account.login === "logged_in").length;
              toast.info(
                `已检查 ${results.length} 个账号，${loggedIn} 个已登录，${results.length - loggedIn} 个需处理`,
              );
            }
          } catch (error) {
            toast.error(userErrorMessage(error, "账号检查未完成，请稍后重试。"));
          }
        }}
        onDelete={(account) => void run(() => removeAccount(account.id))}
      />
    </DocumentPage>
  );
}
