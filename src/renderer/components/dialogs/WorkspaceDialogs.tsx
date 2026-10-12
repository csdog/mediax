import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/app/WorkspaceContext";

export function WorkspaceDialogs() {
  const {
    accountDialogOpen,
    setAccountDialogOpen,
    busy,
    platform,
    setPlatform,
    name,
    setName,
    run,
    accounts,
    reload,
    openBrowser,
    setNotice,
    verifyDialogTarget,
    setVerifyDialogTarget,
    verifyUrl,
    setVerifyUrl,
  } = useWorkspace();
  return (
    <>
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>添加账号</DialogTitle>
            <DialogDescription>选择平台，打开独立浏览器完成登录授权。</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || platform !== "facebook") return;
              void run(async () => {
                const account = await window.desktop.addAccount(
                  name.trim() || `Facebook 账号 ${accounts.length + 1}`,
                );
                await reload();
                setAccountDialogOpen(false);
                await openBrowser(account);
                setNotice("请在账号浏览器中完成登录，返回后点击「检查状态」。");
              });
            }}
          >
            <div className="space-y-2">
              <Label>选择平台</Label>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-between p-4"
                aria-pressed={platform === "facebook"}
                disabled={busy}
                onClick={() => setPlatform("facebook")}
              >
                <span className="text-left">
                  <span className="block">Facebook</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    个人主页与公共主页
                  </span>
                </span>
                {platform === "facebook" && <CheckCircle2 />}
              </Button>
              <p className="text-xs text-muted-foreground">首版支持 Facebook，其他平台后续开放。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">账号名称（可选）</Label>
              <Input
                id="account-name"
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：个人账号 / 工作账号"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAccountDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy || !platform}>
                {busy ? "正在打开…" : "开始授权"}
                <ExternalLink />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(verifyDialogTarget)}
        onOpenChange={(open) => {
          if (!open) setVerifyDialogTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核验发布结果</DialogTitle>
            <DialogDescription>
              此操作只检查帖子，不会重新发布。可填写你在 Facebook
              找到的本次帖子链接，留空则检查已有提交证据。
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="verify-post-url">帖子链接</Label>
          <Input
            id="verify-post-url"
            value={verifyUrl}
            onChange={(event) => setVerifyUrl(event.target.value)}
            placeholder="https://www.facebook.com/…/posts/…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogTarget(null)}>
              取消
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.desktop.verifyTarget(
                    verifyDialogTarget!.id,
                    verifyUrl.trim() || undefined,
                  );
                  setVerifyDialogTarget(null);
                  await reload();
                  setNotice("已核验帖子作者与内容");
                })
              }
            >
              核验帖子
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
