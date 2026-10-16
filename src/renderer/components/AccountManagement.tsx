import { useState, type MouseEvent, type KeyboardEvent } from "react";
import { AccountGroupSheet } from "./AccountGroupSheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userErrorMessage } from "../../shared/userError";
import {
  Layers,
  Search,
  Plus,
  LayoutGrid,
  List,
  Monitor,
  RefreshCw,
  Trash2,
  Users,
  Folder,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountIdentity, PlatformGlyph } from "@/components/AccountIdentity";
import { ActionIconButton } from "@/components/workspace/ActionIconButton";
import { NumberFlow } from "@/components/ui/number-flow";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { platforms, type AccountInfo, type PlatformId } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";
function platformOf(account: AccountInfo): PlatformId {
  return account.platform ?? "facebook";
}

const loginLabels = {
  unchecked: "待检查",
  logged_in: "已登录",
  logged_out: "未登录",
  needs_verification: "需要验证",
};

type Props = {
  accounts: AccountInfo[];
  busy: boolean;
  /** Pass a platform id to skip the picker when the sidebar already filters one. */
  onAuthorize(platformId?: PlatformId): void;
  onOpen(account: AccountInfo): void;
  onRefresh(ids: string[]): Promise<void>;
  onDelete(account: AccountInfo): void;
};

export function AccountManagement({
  accounts,
  busy,
  onAuthorize,
  onOpen,
  onRefresh,
  onDelete,
}: Props) {
  const queryClient = useQueryClient();
  const groupsQuery = useQuery({
    queryKey: ["account-groups"],
    queryFn: () => window.desktop.accountGroups(),
  });
  const groups = groupsQuery.data ?? [];
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAccountIds, setGroupAccountIds] = useState<string[]>([]);
  const createGroup = useMutation({
    mutationFn: () =>
      window.desktop.createAccountGroup({ name: groupName, accountIds: groupAccountIds }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["account-groups"] });
      setGroupId(created.id);
      setGroupDialogOpen(false);
      setGroupName("");
      setGroupAccountIds([]);
      toast.success("分组已创建");
    },
    onError: (error) => toast.error(userErrorMessage(error, "分组保存失败，请重试。")),
  });
  const activeGroup = groups.find((group) => group.id === groupId);
  const [query, setQuery] = useState("");
  const [platformQuery, setPlatformQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingAccount, setEditingAccount] = useState<AccountInfo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountInfo | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
  const filtered = accounts.filter(
    (a) =>
      (!activeGroup || activeGroup.accountIds.includes(a.id)) &&
      a.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (platform === "all" || platformOf(a) === platform) &&
      (status === "all" || a.login === status),
  );
  const openAccountSettings = (account: AccountInfo) => {
    if (groupsQuery.isPending) return;
    if (groupsQuery.isError) {
      toast.error("分组加载失败，请先重试。");
      return;
    }
    setEditingAccount(account);
  };
  const onAccountRowClick = (event: MouseEvent<HTMLElement>, account: AccountInfo) => {
    if ((event.target as Element).closest("button, input, a, [role='checkbox']")) return;
    openAccountSettings(account);
  };
  const onAccountRowKey = (event: KeyboardEvent<HTMLElement>, account: AccountInfo) => {
    if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openAccountSettings(account);
  };
  const chosen = selected.filter((id) => accounts.some((a) => a.id === id));
  const allSelected = filtered.length > 0 && filtered.every((a) => chosen.includes(a.id));
  const toggle = (id: string, checked: boolean) =>
    setSelected((old) => (checked ? [...new Set([...old, id])] : old.filter((x) => x !== id)));
  const selectedPlatform = platform !== "all" ? (platform as PlatformId) : undefined;
  const startAuthorize = () => onAuthorize(selectedPlatform);
  const refresh = async (ids: string[]) => {
    if (!ids.length || ids.every((id) => refreshingIds.includes(id))) return;
    setRefreshingIds((old) => [...new Set([...old, ...ids])]);
    try {
      await onRefresh(ids);
    } finally {
      setRefreshingIds((old) => old.filter((id) => !ids.includes(id)));
    }
  };
  const batchRefreshing = chosen.some((id) => refreshingIds.includes(id));
  const identity = (account: AccountInfo) => (
    <AccountIdentity name={account.name} platform={platformOf(account)} avatar={account.avatar} />
  );
  const login = (account: AccountInfo) => (
    <Badge variant="outline" className={`account-login-badge status-${account.login}`}>
      {loginLabels[account.login]}
    </Badge>
  );
  const actions = (account: AccountInfo) => {
    const refreshing = refreshingIds.includes(account.id);
    return (
      <div className="inline-flex flex-wrap items-center justify-center gap-1 [.account-grid-item_&]:mt-2 [.account-grid-item_&]:justify-start">
        <ActionIconButton
          label={refreshing ? "正在检查…" : "检查状态与发布身份"}
          disabled={busy || refreshing}
          onClick={() => void refresh([account.id])}
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} />
        </ActionIconButton>
        <ActionIconButton label="打开账号" disabled={busy} onClick={() => onOpen(account)}>
          <Monitor />
        </ActionIconButton>
        <ActionIconButton
          label={`删除 ${account.name}`}
          disabled={busy}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setPendingDelete(account)}
        >
          <Trash2 />
        </ActionIconButton>
      </div>
    );
  };
  return (
    <section className="account-management" aria-label="账号管理工作区">
      {editingAccount && (
        <AccountGroupSheet
          key={editingAccount.id}
          account={accounts.find((a) => a.id === editingAccount.id) ?? editingAccount}
          groups={groups}
          onClose={() => setEditingAccount(null)}
          onOpen={onOpen}
        />
      )}
      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          if (createGroup.isPending) return;
          setGroupDialogOpen(open);
          if (!open) {
            setGroupName("");
            setGroupAccountIds([]);
          }
        }}
      >
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createGroup.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>新建分组</DialogTitle>
              <DialogDescription>为分组命名，并选择要放入的账号。</DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-2 text-sm">
              分组名称
              <Input
                autoFocus
                value={groupName}
                maxLength={40}
                placeholder="例如：工作账号"
                disabled={createGroup.isPending}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm">选择账号（可选）</legend>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted"
                  >
                    <Checkbox
                      aria-label={`加入分组 ${account.name}`}
                      disabled={createGroup.isPending}
                      checked={groupAccountIds.includes(account.id)}
                      onCheckedChange={(checked) =>
                        setGroupAccountIds((old) =>
                          checked
                            ? [...new Set([...old, account.id])]
                            : old.filter((id) => id !== account.id),
                        )
                      }
                    />
                    <span className="truncate text-sm">{account.name}</span>
                  </label>
                ))}
                {!accounts.length && (
                  <p className="text-xs text-muted-foreground">暂无账号，可以先创建空分组。</p>
                )}
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createGroup.isPending}
                onClick={() => {
                  setGroupDialogOpen(false);
                  setGroupName("");
                  setGroupAccountIds([]);
                }}
              >
                取消
              </Button>
              <Button type="submit" disabled={!groupName.trim() || createGroup.isPending}>
                {createGroup.isPending ? "保存中…" : "创建分组"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除账号</DialogTitle>
            <DialogDescription>
              删除「{pendingDelete?.name}
              」会关闭它的浏览器，并移除这个账号的发布记录。未完成的发布需要先处理完。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !pendingDelete}
              onClick={() => {
                if (!pendingDelete) return;
                const account = pendingDelete;
                setPendingDelete(null);
                onDelete(account);
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="account-section-header">
        <span>账号管理</span>
        <span className="account-total">
          <NumberFlow value={accounts.length} /> 个账号
        </span>
      </div>
      <div className="account-management-body">
        <aside className="account-filters" aria-label="平台与分组筛选">
          <div className="account-filter-section">
            <h2>平台</h2>
            <div className="account-search">
              <Search />
              <Input
                aria-label="搜索平台"
                placeholder="搜索平台"
                value={platformQuery}
                onChange={(e) => setPlatformQuery(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              className="account-filter-item"
              aria-pressed={platform === "all"}
              onClick={() => setPlatform("all")}
            >
              <Layers />
              全部平台
              <span>
                <NumberFlow value={accounts.length} />
              </span>
            </Button>
            {platforms
              .filter((id) =>
                platformInfo[id].label.toLowerCase().includes(platformQuery.trim().toLowerCase()),
              )
              .map((id) => (
                <Button
                  key={id}
                  variant="ghost"
                  className="account-filter-item"
                  aria-pressed={platform === id}
                  onClick={() => setPlatform(id)}
                >
                  <PlatformGlyph id={id} />
                  {platformInfo[id].label}
                  <span>
                    <NumberFlow
                      value={accounts.filter((account) => platformOf(account) === id).length}
                    />
                  </span>
                </Button>
              ))}
          </div>
          <div className="account-filter-section account-groups">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="mb-0!">分组</h2>
              {groups.length > 0 && (
                <ActionIconButton
                  label="新建分组"
                  disabled={busy}
                  onClick={() => setGroupDialogOpen(true)}
                >
                  <Plus />
                </ActionIconButton>
              )}
            </div>
            <Button
              variant="ghost"
              className="account-filter-item"
              aria-label={`全部分组，${accounts.length} 个账号`}
              aria-pressed={!activeGroup}
              onClick={() => setGroupId(null)}
            >
              <Folder />
              <span className="min-w-0 flex-1 truncate text-left">全部分组</span>
              <span className="shrink-0 tabular-nums">
                <NumberFlow value={accounts.length} />
              </span>
            </Button>
            {groups.map((group) => (
              <Button
                key={group.id}
                variant="ghost"
                className="account-filter-item"
                aria-label={`${group.name}，${accounts.filter((a) => group.accountIds.includes(a.id)).length} 个账号`}
                aria-pressed={group.id === groupId}
                onClick={() => setGroupId(group.id)}
              >
                <Folder />
                <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
                <span className="shrink-0 tabular-nums">
                  <NumberFlow
                    value={accounts.filter((a) => group.accountIds.includes(a.id)).length}
                  />
                </span>
              </Button>
            ))}
            {groupsQuery.isError ? (
              <Empty className="gap-3 px-2 py-5">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">分组加载失败</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => void groupsQuery.refetch()}>
                    重试
                  </Button>
                </EmptyContent>
              </Empty>
            ) : !groupsQuery.isPending && !groups.length ? (
              <Empty className="mt-3 gap-3 px-2 py-5">
                <EmptyHeader className="gap-1.5">
                  <EmptyMedia variant="icon" className="mb-1 size-8 text-muted-foreground">
                    <Folder className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-medium">暂无分组</EmptyTitle>
                  <EmptyDescription className="text-xs">用分组整理你的账号</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setGroupDialogOpen(true)}
                  >
                    <Plus />
                    新建分组
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}
          </div>
        </aside>
        <div className="account-results">
          <div className="account-toolbar">
            <div className="account-query-controls">
              <Select
                items={[
                  { value: "all", label: "全部状态" },
                  ...Object.entries(loginLabels).map(([value, label]) => ({ value, label })),
                ]}
                value={status}
                onValueChange={(value) => setStatus(value ?? "all")}
              >
                <SelectTrigger aria-label="登录状态">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(loginLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="account-search">
                <Search />
                <Input
                  aria-label="搜索账号名称"
                  placeholder="搜索账号名称"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="account-toolbar-actions">
              <div className="account-view-toggle" role="group" aria-label="账号显示方式">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="网格视图"
                        aria-pressed={view === "grid"}
                        onClick={() => setView("grid")}
                      >
                        <LayoutGrid />
                      </Button>
                    }
                  />
                  <TooltipContent>网格视图</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="列表视图"
                        aria-pressed={view === "list"}
                        onClick={() => setView("list")}
                      >
                        <List />
                      </Button>
                    }
                  />
                  <TooltipContent>列表视图</TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                disabled={busy || !chosen.length || batchRefreshing}
                onClick={() => void refresh(chosen)}
              >
                <RefreshCw className={cn(batchRefreshing && "animate-spin")} />
                批量检查{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
              <Button disabled={busy} aria-label="添加账号" onClick={startAuthorize}>
                <Plus />
                授权账号
                {selectedPlatform ? ` · ${platformInfo[selectedPlatform].label}` : ""}
              </Button>
            </div>
          </div>
          <div className={`account-list-surface ${view === "grid" ? "account-grid-surface" : ""}`}>
            {!filtered.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>
                    {accounts.length ? "没有匹配的账号" : "添加你的第一个账号"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {accounts.length
                      ? selectedPlatform
                        ? `当前筛选「${platformInfo[selectedPlatform].label}」下没有账号，可直接授权该平台。`
                        : "试试其他名称或登录状态，或授权一个新账号。"
                      : "每个账号使用独立的浏览器会话；授权后即可在本机发布。"}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button disabled={busy} onClick={startAuthorize}>
                    <Plus />
                    授权账号
                    {selectedPlatform ? ` · ${platformInfo[selectedPlatform].label}` : ""}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : view === "list" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="account-checkbox-cell">
                      <Checkbox
                        aria-label="选择当前列表全部账号"
                        checked={allSelected}
                        indeterminate={!allSelected && filtered.some((a) => chosen.includes(a.id))}
                        onCheckedChange={(checked) =>
                          setSelected((old) =>
                            checked === true
                              ? [...new Set([...old, ...filtered.map((a) => a.id)])]
                              : old.filter((id) => !filtered.some((a) => a.id === id)),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>账号信息</TableHead>
                    <TableHead>登录状态</TableHead>
                    <TableHead>发布身份</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow
                      key={a.id}
                      tabIndex={0}
                      aria-label={`${a.name} 账号信息`}
                      aria-haspopup="dialog"
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={(event) => onAccountRowClick(event, a)}
                      onKeyDown={(event) => onAccountRowKey(event, a)}
                      data-state={chosen.includes(a.id) ? "selected" : undefined}
                    >
                      <TableCell className="account-checkbox-cell">
                        <Checkbox
                          aria-label={`选择账号 ${a.name}`}
                          checked={chosen.includes(a.id)}
                          onCheckedChange={(checked) => toggle(a.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell>{identity(a)}</TableCell>
                      <TableCell>{login(a)}</TableCell>
                      <TableCell>
                        <div className="account-targets">
                          {a.targets.length ? (
                            a.targets.map((target) => (
                              <span key={target.identityId}>
                                {target.name}
                                <small>{target.kind === "page" ? "公共主页" : "个人主页"}</small>
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">待检查</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{actions(a)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="account-grid">
                {filtered.map((a) => (
                  <article className="account-grid-item" key={a.id}>
                    <div className="account-grid-heading">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        aria-label={`设置 ${a.name}`}
                        onClick={() => openAccountSettings(a)}
                      >
                        {identity(a)}
                      </button>
                      <Checkbox
                        aria-label={`选择账号 ${a.name}`}
                        checked={chosen.includes(a.id)}
                        onCheckedChange={(checked) => toggle(a.id, checked === true)}
                      />
                    </div>
                    {login(a)}
                    <p className="text-muted-foreground">{a.targets.length} 个发布身份</p>
                    {actions(a)}
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="account-results-footer">
            <span>
              共 <NumberFlow value={filtered.length} /> 个账号
            </span>
            <span>
              {chosen.length ? (
                <>
                  已选择 <NumberFlow value={chosen.length} /> 个账号
                </>
              ) : (
                "账号会话保存在本机"
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
