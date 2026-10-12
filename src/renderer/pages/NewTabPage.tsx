import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWorkspace } from "@/app/WorkspaceContext";

export function NewTabPage() {
  const { accounts, busy, run, openBrowser, setPlatform, setName, setAccountDialogOpen, notice } =
    useWorkspace();
  return (
    <main className="new-tab-page">
      <div className="new-tab-content">
        <h1 className="text-lg font-medium">新标签页</h1>
        <p className="mt-2 text-sm text-muted-foreground">选择账号打开浏览器</p>
        <div className="mt-6 space-y-1">
          {accounts.map((account) => (
            <Button
              key={account.id}
              aria-label={account.name}
              variant="ghost"
              className="h-12 w-full justify-start gap-3 px-3 font-normal"
              disabled={busy}
              onClick={() => void run(() => openBrowser(account))}
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{account.name[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate">{account.name}</span>
              <ExternalLink className="ml-auto size-4 text-muted-foreground" />
            </Button>
          ))}
          {!accounts.length && (
            <p className="py-4 text-sm text-muted-foreground">
              添加账号后，即可在这里打开账号浏览器。
            </p>
          )}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setPlatform(null);
            setName("");
            setAccountDialogOpen(true);
          }}
        >
          <Plus />
          添加账号
        </Button>
        {notice && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}
