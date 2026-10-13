import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Empty,
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
import type { AccountInfo } from "../../shared/models";

const loginLabels = {
  unchecked: "待检查",
  logged_in: "已登录",
  logged_out: "未登录",
  needs_verification: "需要验证",
};

type Props = {
  accounts: AccountInfo[];
  busy: boolean;
  onAuthorize(): void;
  onOpen(account: AccountInfo): void;
  onRefresh(ids: string[]): void;
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
  const [query, setQuery] = useState("");
  const [platformQuery, setPlatformQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<AccountInfo | null>(null);
  const filtered = accounts.filter(
    (a) =>
      a.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (status === "all" || a.login === status),
  );
  const chosen = selected.filter((id) => accounts.some((a) => a.id === id));
  const allSelected = filtered.length > 0 && filtered.every((a) => chosen.includes(a.id));
  const toggle = (id: string, checked: boolean) =>
    setSelected((old) => (checked ? [...new Set([...old, id])] : old.filter((x) => x !== id)));
  const identity = (account: AccountInfo) => (
    <div className="account-identity">
      <Avatar className="size-10">
        {account.avatar && <AvatarImage src={account.avatar} alt={`${account.name} 头像`} />}
        <AvatarFallback>{account.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="truncate font-medium">{account.name}</h2>
        <p className="account-platform-label">
          <span className="facebook-mark" aria-hidden="true">
            f
          </span>
          Facebook
        </p>
      </div>
    </div>
  );
  const login = (account: AccountInfo) => (
    <span className="account-login">
      <span className={`account-status-dot status-${account.login}`} />
      {loginLabels[account.login]}
    </span>
  );
  const actions = (account: AccountInfo) => (
    <div className="account-row-actions">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="打开浏览器"
              disabled={busy}
              onClick={() => onOpen(account)}
            >
              <Monitor />
            </Button>
          }
        />
        <TooltipContent>打开浏览器</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="检查状态"
              disabled={busy}
              onClick={() => onRefresh([account.id])}
            >
              <RefreshCw />
            </Button>
          }
        />
        <TooltipContent>检查状态与发布身份</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`删除 ${account.name}`}
              disabled={busy}
              onClick={() => setPendingDelete(account)}
            >
              <Trash2 />
            </Button>
          }
        />
        <TooltipContent>删除</TooltipContent>
      </Tooltip>
    </div>
  );
  return (
    <section className="account-management" aria-label="账号管理工作区">
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
        <span className="account-total">{accounts.length} 个账号</span>
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
              全部平台<span>{accounts.length}</span>
            </Button>
            {"facebook".includes(platformQuery.trim().toLowerCase()) && (
              <Button
                variant="ghost"
                className="account-filter-item"
                aria-pressed={platform === "facebook"}
                onClick={() => setPlatform("facebook")}
              >
                <span className="facebook-mark" aria-hidden="true">
                  f
                </span>
                Facebook<span>{accounts.length}</span>
              </Button>
            )}
          </div>
          <div className="account-filter-section account-groups">
            <h2>分组</h2>
            <div className="account-filter-item account-group-all">
              <Folder />
              全部分组<span>{accounts.length}</span>
            </div>
            <p>暂无分组</p>
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
                disabled={busy || !chosen.length}
                onClick={() => onRefresh(chosen)}
              >
                <RefreshCw />
                批量检查{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
              <Button disabled={busy} aria-label="添加账号" onClick={onAuthorize}>
                <Plus />
                授权账号
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
                      ? "试试其他名称或登录状态。"
                      : "点击右上角授权账号，每个账号使用独立的浏览器会话。"}
                  </EmptyDescription>
                </EmptyHeader>
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
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow
                      key={a.id}
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
                      <TableCell>{actions(a)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="account-grid">
                {filtered.map((a) => (
                  <article className="account-grid-item" key={a.id}>
                    <div className="account-grid-heading">
                      {identity(a)}
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
            <span>共 {filtered.length} 个账号</span>
            <span>{chosen.length ? `已选择 ${chosen.length} 个账号` : "账号会话保存在本机"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
