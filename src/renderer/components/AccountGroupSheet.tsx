import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Monitor } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { AccountIdentity } from "@/components/AccountIdentity";
import { userErrorMessage } from "../../shared/userError";
import type { AccountGroup, AccountInfo } from "../../shared/models";

export function AccountGroupSheet({
  account,
  groups,
  onClose,
  onOpen,
}: {
  account: AccountInfo;
  groups: AccountGroup[];
  onClose(): void;
  onOpen(account: AccountInfo): void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
  const close = () => setOpen(false);
  const [selected, setSelected] = useState(() =>
    groups.filter((g) => g.accountIds.includes(account.id)).map((g) => g.id),
  );
  const save = useMutation({
    mutationFn: () => window.desktop.setAccountGroups(account.id, selected),
    onSuccess: (next) => {
      client.setQueryData(["account-groups"], next);
      toast.success("账号分组已保存");
      close();
    },
    onError: (error) => toast.error(userErrorMessage(error, "账号分组保存失败，请重试。")),
  });
  return (
    <Sheet
      open={open}
      onOpenChange={(open) => {
        if (!open && !save.isPending) close();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        showCloseButton={!save.isPending}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>账号设置</SheetTitle>
          <SheetDescription>查看账号信息并设置所属分组。</SheetDescription>
          <div className="pt-4">
            <AccountIdentity
              name={account.name}
              platform={account.platform}
              avatar={account.avatar}
            />
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-medium">所属分组</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            可选择多个分组，取消全部选择即移出所有分组。
          </p>
          {groups.length ? (
            <div className="mt-4 flex flex-col gap-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted"
                >
                  <Checkbox
                    aria-label={`所属分组 ${group.name}`}
                    checked={selected.includes(group.id)}
                    disabled={save.isPending}
                    onCheckedChange={(checked) =>
                      setSelected((old) =>
                        checked
                          ? [...new Set([...old, group.id])]
                          : old.filter((id) => id !== group.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{group.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <Empty className="px-0 py-10">
              <EmptyHeader>
                <EmptyTitle className="text-sm">暂无分组</EmptyTitle>
                <EmptyDescription className="text-xs">
                  请先在账号管理的分组区域新建分组。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              close();
              onOpen(account);
            }}
          >
            <Monitor />
            打开账号
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={close}>
            取消
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            <Save />
            {save.isPending ? "保存中…" : "保存配置"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
