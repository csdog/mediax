import { useMemo, useState, type ReactNode } from "react";
import {
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  LayoutGrid,
  List,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { PublishKindDialog } from "@/components/workspace/PublishKindDialog";
import { useWorkspace } from "@/app/WorkspaceContext";
import type { AccountInfo, Status, Task, TaskTarget } from "../../shared/models";

type Pane = "records" | "drafts" | "review";
type Tone = "success" | "warning" | "danger" | "muted" | "progress";

const statusFilters = [
  { value: "all", label: "全部发布状态" },
  { value: "success", label: "成功" },
  { value: "failed", label: "发布失败" },
  { value: "active", label: "发布中" },
  { value: "scheduled", label: "已排期" },
];

function titleOf(body: string) {
  const line = body
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);
  return line || "未命名作品";
}

function stamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function publishModeLabel(task: Task, targets: TaskTarget[]) {
  if (task.scheduledAt || targets.some((target) => target.status === "scheduled"))
    return task.scheduledAt ? `定时 ${stamp(task.scheduledAt)}` : "定时发布";
  return "立即发布";
}

function summary(targets: TaskTarget[]): { label: string; tone: Tone } {
  const statuses = targets.map((target) => target.status);
  const has = (status: Status) => statuses.includes(status);
  if (statuses.length && statuses.every((status) => status === "verified"))
    return { label: "成功", tone: "success" };
  if (has("verified") && has("failed")) return { label: "部分发布成功", tone: "warning" };
  if (has("failed") && statuses.every((status) => status === "failed"))
    return { label: "发布失败", tone: "danger" };
  if (statuses.length && statuses.every((status) => status === "scheduled"))
    return { label: "已排期", tone: "muted" };
  if (has("running") || has("submitted")) return { label: "发布中", tone: "progress" };
  if (has("awaiting_user")) return { label: "等待处理", tone: "warning" };
  if (has("unknown")) return { label: has("verified") ? "部分失败" : "发布失败", tone: "danger" };
  if (statuses.every((status) => status === "pending")) return { label: "排队中", tone: "muted" };
  if (has("scheduled")) return { label: "部分排期", tone: "muted" };
  if (has("failed")) return { label: "部分失败", tone: "danger" };
  return { label: "进行中", tone: "progress" };
}

function publisherNames(targets: TaskTarget[], accounts: AccountInfo[]) {
  return [
    ...new Set(
      targets.map(
        (target) =>
          accounts.find((account) => account.id === target.accountId)?.name ?? target.name,
      ),
    ),
  ];
}

function matchesStatus(targets: TaskTarget[], filter: string) {
  if (filter === "all") return true;
  const state = summary(targets);
  if (filter === "success") return state.label === "成功";
  if (filter === "failed")
    return targets.some((target) => target.status === "failed" || target.status === "unknown");
  if (filter === "active")
    return targets.some((target) =>
      ["pending", "running", "awaiting_user", "submitted"].includes(target.status),
    );
  if (filter === "scheduled") return targets.some((target) => target.status === "scheduled");
  return false;
}

export function HistoryPage() {
  const { records, focusedTask, run, busy, accounts, reload, openPublish, body, images } =
    useWorkspace();
  const [pane, setPane] = useState<Pane>("records");
  const [query, setQuery] = useState("");
  const [publisher, setPublisher] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [publishKindOpen, setPublishKindOpen] = useState(false);
  const draftCount = body.trim() || images.length ? 1 : 0;
  const publishers = useMemo(() => {
    const names = new Map<string, string>();
    for (const target of records.targets) {
      names.set(
        target.accountId,
        accounts.find((account) => account.id === target.accountId)?.name ?? target.name,
      );
    }
    return [...names.entries()];
  }, [accounts, records.targets]);
  const rows = useMemo(
    () =>
      records.tasks
        .map((task) => ({
          task,
          targets: records.targets.filter((target) => target.taskId === task.id),
        }))
        .filter(({ task, targets }) => {
          const names = publisherNames(targets, accounts);
          const workKind = task.contentKind;
          const text = `${task.body} ${names.join(" ")}`.toLocaleLowerCase();
          return (
            text.includes(query.trim().toLocaleLowerCase()) &&
            (publisher === "all" || targets.some((target) => target.accountId === publisher)) &&
            (kind === "all" || workKind === kind) &&
            matchesStatus(targets, status) &&
            (mode === "all" || mode === "now")
          );
        }),
    [accounts, kind, mode, publisher, query, records.tasks, records.targets, status],
  );
  const failed = rows.flatMap(({ targets }) =>
    targets.filter((target) => target.status === "failed"),
  );
  const exportRows = () => {
    const header = ["作品", "类型", "发布人", "发布方式", "任务概况", "状态", "创建时间"];
    const lines = [
      header,
      ...rows.map(({ task, targets }) => {
        const names = publisherNames(targets, accounts);
        const accountCount = new Set(targets.map((target) => target.accountId)).size;
        return [
          titleOf(task.body),
          kindLabel[task.contentKind],
          names.join("、"),
          "立即发布",
          `${accountCount} 账号 · ${targets.length} 任务`,
          summary(targets).label,
          stamp(task.createdAt),
        ];
      }),
    ];
    const csv = lines
      .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "发布记录.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <DocumentPage>
      <section className="history-page" aria-label="发布记录工作区">
        <div className="history-tabs" role="tablist" aria-label="发布记录分区">
          {(
            [
              ["records", "发布记录"],
              ["drafts", "草稿箱"],
              ["review", "待审核"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
            >
              {label}
              {id === "drafts" && draftCount > 0 && (
                <span className="history-tab-count">{draftCount}</span>
              )}
            </button>
          ))}
        </div>
        {pane === "records" ? (
          <div className="history-body">
            <div className="history-toolbar">
              <div className="history-filters">
                <div className="account-search">
                  <Search />
                  <Input
                    aria-label="搜索作品描述或任务标题"
                    placeholder="搜索作品描述或任务标题"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Filter
                  label="发布人"
                  value={publisher}
                  onChange={setPublisher}
                  options={[
                    { value: "all", label: "全部发布人" },
                    ...publishers.map(([value, label]) => ({ value, label })),
                  ]}
                />
                <Filter
                  label="作品类型"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "all", label: "全部作品类型" },
                    { value: "article", label: "文章" },
                    { value: "moment", label: "图文" },
                    { value: "video", label: "视频" },
                    { value: "audio", label: "音频" },
                  ]}
                />
                <Filter
                  label="发布状态"
                  value={status}
                  onChange={setStatus}
                  options={statusFilters}
                />
                <div className="history-mode">
                  <Filter
                    label="发布模式"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: "all", label: "全部发布模式" },
                      { value: "now", label: "立即发布" },
                    ]}
                  />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="发布模式说明">
                          <CircleHelp />
                        </Button>
                      }
                    />
                    <TooltipContent>首版只支持立即发布。</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="account-toolbar-actions">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" disabled={busy || !rows.length}>
                        批量操作
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!failed.length || busy}
                      onClick={() =>
                        void run(async () => {
                          for (const target of failed) await window.desktop.retry(target.id);
                          await reload();
                        })
                      }
                    >
                      重试失败项{failed.length ? ` (${failed.length})` : ""}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="account-view-toggle" role="group" aria-label="记录显示方式">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="列表视图"
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    <List />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="网格视图"
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                  >
                    <LayoutGrid />
                  </Button>
                </div>
                <Button variant="outline" disabled={!rows.length} onClick={exportRows}>
                  <Download />
                  导出
                </Button>
                <Button onClick={() => setPublishKindOpen(true)}>
                  <Plus />
                  新增发布
                </Button>
              </div>
            </div>
            <PublishKindDialog
              open={publishKindOpen}
              onOpenChange={setPublishKindOpen}
              onSelect={(next) => {
                openPublish(next);
                void run(reload);
              }}
            />
            <div
              className={`account-list-surface ${view === "grid" ? "account-grid-surface" : ""}`}
            >
              {!rows.length ? (
                <Empty className="py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>
                      {records.tasks.length ? "没有匹配的发布记录" : "暂无发布记录"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {records.tasks.length
                        ? "试试其他标题、发布人或状态。"
                        : "发布后，在这里查看每个作品的状态和结果。"}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : view === "list" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>作品</TableHead>
                      <TableHead>发布人</TableHead>
                      <TableHead>发布方式</TableHead>
                      <TableHead>任务概况</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <RecordRow key={row.task.id} {...row} focused={focusedTask === row.task.id} />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="account-grid">
                  {rows.map((row) => (
                    <article
                      className="account-grid-item"
                      key={row.task.id}
                      data-focused={focusedTask === row.task.id || undefined}
                    >
                      <Work task={row.task} />
                      <RecordFacts {...row} />
                      <RecordActions {...row} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : pane === "drafts" ? (
          <DraftPane />
        ) : (
          <Empty className="m-auto py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>暂无待审核</EmptyTitle>
              <EmptyDescription>首版本机直接发布，没有审核队列。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </DocumentPage>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => onChange(next ?? "all")}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const kindLabel = { article: "文章", moment: "图文", video: "视频", audio: "音频" };
function Work({ task, cover = task.cover }: { task: Task; cover?: string | null }) {
  const kind = task.contentKind;
  const Icon =
    kind === "video"
      ? Video
      : kind === "audio"
        ? Music
        : kind === "moment" || cover
          ? ImageIcon
          : FileText;
  return (
    <div className="history-work">
      <span className="history-thumb">
        {cover ? (
          <img src={cover} alt={`${titleOf(task.body)} 封面`} />
        ) : (
          <Icon aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="history-title" title={task.body}>
          {titleOf(task.body)}
        </span>
        <span className="history-kind">
          <Icon />
          {kindLabel[kind]}
        </span>
      </span>
    </div>
  );
}

function StatusBadge({ state, title }: { state: { label: string; tone: Tone }; title?: string }) {
  return (
    <Badge
      variant="secondary"
      className={`history-status-badge status-${state.tone}`}
      title={title}
    >
      {state.label}
    </Badge>
  );
}

function RecordFacts({ task, targets }: { task: Task; targets: TaskTarget[] }) {
  const { accounts } = useWorkspace();
  const names = publisherNames(targets, accounts);
  const accountCount = new Set(targets.map((target) => target.accountId)).size;
  const state = summary(targets);
  return (
    <>
      <span className="history-publisher">{names.join("、") || "未指定"}</span>
      <span>{publishModeLabel(task, targets)}</span>
      <span className="text-muted-foreground">
        {accountCount} 账号 · {targets.length} 任务
      </span>
      <StatusBadge state={state} />
      <span className="text-muted-foreground">
        {task.scheduledAt ? stamp(task.scheduledAt) : stamp(task.createdAt)}
      </span>
    </>
  );
}

function RecordRow({
  task,
  targets,
  focused,
}: {
  task: Task;
  targets: TaskTarget[];
  focused: boolean;
}) {
  const { accounts } = useWorkspace();
  const names = publisherNames(targets, accounts);
  const accountCount = new Set(targets.map((target) => target.accountId)).size;
  const state = summary(targets);
  return (
    <TableRow className={focused ? "bg-accent" : undefined}>
      <TableCell>
        <Work task={task} />
      </TableCell>
      <TableCell>{names.join("、") || "未指定"}</TableCell>
      <TableCell>{publishModeLabel(task, targets)}</TableCell>
      <TableCell className="text-muted-foreground">
        {accountCount} 账号 · {targets.length} 任务
      </TableCell>
      <TableCell>
        <StatusBadge
          state={state}
          title={targets
            .map((target) => target.error)
            .filter((error): error is string => Boolean(error))
            .join("\n")}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {task.scheduledAt ? stamp(task.scheduledAt) : stamp(task.createdAt)}
      </TableCell>
      <TableCell className="text-center">
        <RecordActions task={task} targets={targets} />
      </TableCell>
    </TableRow>
  );
}

function actionLabel(verb: string, name: string, many: boolean) {
  return many ? `${verb} ${name}` : verb;
}

function ActionIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RecordActions({ task: _task, targets }: { task: Task; targets: TaskTarget[] }) {
  const { run, busy, openBrowser, accounts, reload } = useWorkspace();
  const accountsInTask = [...new Map(targets.map((target) => [target.accountId, target])).values()];
  const manyTargets = targets.length > 1;
  const manyAccounts = accountsInTask.length > 1;
  return (
    <div className="history-record-actions">
      {targets.flatMap((target) => {
        const items = [];
        if (target.url)
          items.push(
            <ActionIconButton
              key={`${target.id}-open`}
              label={actionLabel("打开", target.name, manyTargets)}
              onClick={() => void run(() => window.desktop.openPost(target.url!))}
            >
              <ExternalLink />
            </ActionIconButton>,
          );
        if (["failed", "submitted", "verified", "unknown"].includes(target.status))
          items.push(
            <ActionIconButton
              key={`${target.id}-republish`}
              label={actionLabel("重新发布", target.name, manyTargets)}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.desktop.republish(target.id);
                  await reload();
                })
              }
            >
              <RefreshCw />
            </ActionIconButton>,
          );
        if (target.status === "pending" || target.status === "awaiting_user")
          items.push(
            <ActionIconButton
              key={`${target.id}-resume`}
              label={actionLabel("继续", target.name, manyTargets)}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.desktop.resume(target.id);
                  await reload();
                })
              }
            >
              <Play />
            </ActionIconButton>,
          );
        return items;
      })}
      {accountsInTask.map((target) => {
        const name =
          accounts.find((account) => account.id === target.accountId)?.name ?? target.name;
        return (
          <ActionIconButton
            key={`${target.accountId}-browser`}
            label={actionLabel("打开账号", name, manyAccounts)}
            disabled={busy}
            onClick={() => void run(() => openBrowser({ id: target.accountId, name }))}
          >
            <Monitor />
          </ActionIconButton>
        );
      })}
    </div>
  );
}

function DraftPane() {
  const { body, images, contentKind, title, openPublish, run, reload } = useWorkspace();
  if (!body.trim() && !images.length)
    return (
      <Empty className="m-auto py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>草稿箱是空的</EmptyTitle>
          <EmptyDescription>在发布页保存的草稿会出现在这里。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="history-draft">
      <Work
        task={{
          id: "draft",
          body,
          title: title || null,
          contentKind,
          images: images.map((image) => image.path),
          createdAt: "",
        }}
        cover={images[0]?.preview}
      />
      <p className="text-muted-foreground">
        {images.length ? `${images.length} 张图片 · ` : ""}尚未发布
      </p>
      <Button
        variant="outline"
        onClick={() => {
          openPublish(contentKind);
          void run(reload);
        }}
      >
        继续编辑
      </Button>
    </div>
  );
}
