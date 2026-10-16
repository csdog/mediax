"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Monitor } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Field, FieldContent, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { AccountIdentity } from "@/components/AccountIdentity";
import { userErrorMessage } from "../../shared/userError";
import type { AccountGroup, AccountInfo } from "../../shared/models";

export function AccountGroupDrawer({
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
  const isMobile = useIsMobile();
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
    <Drawer
      open={open}
      showSwipeHandle={isMobile}
      swipeDirection={isMobile ? "down" : "right"}
      onOpenChange={(open) => {
        if (!open && !save.isPending) close();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent className="data-[swipe-axis=x]:[--drawer-content-width:calc(100%-1rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:32rem]">
        <DrawerHeader>
          <DrawerTitle>账号设置</DrawerTitle>
          <DrawerDescription>查看账号信息并设置所属分组。</DrawerDescription>
          <div className="pt-4">
            <AccountIdentity
              name={account.name}
              platform={account.platform}
              avatar={account.avatar}
            />
          </div>
        </DrawerHeader>
        <div className="flex-1 scroll-fade overflow-y-auto p-4">
          <h3 className="text-sm font-medium">所属分组</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            可选择多个分组，取消全部选择即移出所有分组。
          </p>
          {groups.length ? (
            <div className="mt-4 flex flex-col gap-2">
              {groups.map((group) => (
                <FieldLabel key={group.id} htmlFor={`account-group-${group.id}`}>
                  <Field orientation="horizontal" data-disabled={save.isPending || undefined}>
                    <FieldContent>
                      <FieldTitle>{group.name}</FieldTitle>
                    </FieldContent>
                    <Checkbox
                      nativeButton
                      render={<button type="button" />}
                      id={`account-group-${group.id}`}
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
                  </Field>
                </FieldLabel>
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
        <DrawerFooter>
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
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            <Save />
            {save.isPending ? "保存中…" : "保存配置"}
          </Button>
          <DrawerClose
            render={
              <Button variant="outline" disabled={save.isPending}>
                取消
              </Button>
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
