import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarIcon,
  ChartColumnIcon,
  CircleCheckIcon,
  ClockIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SendIcon,
  TargetIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { EvilGradientAreaChart } from "@/components/charts/EvilGradientAreaChart";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig } from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { analyticsOptions } from "@/app/queries";
import { platformIcons } from "@/assets/platformIcons";
import { platformInfo } from "../../shared/platforms";
import type { AnalyticsQuery, PlatformId } from "../../shared/models";
import { cn } from "cn";

type RangeMode = { kind: "preset"; days: number } | { kind: "custom"; from: string; to: string };

function toDayString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function queryFromMode(mode: RangeMode): AnalyticsQuery {
  if (mode.kind === "preset") return { days: mode.days };
  return { from: mode.from, to: mode.to };
}

function rangeLabel(mode: RangeMode, daysInData?: number): string {
  if (mode.kind === "preset") return `近 ${mode.days} 天`;
  if (mode.from === mode.to) return mode.from;
  return `${mode.from} ~ ${mode.to}${daysInData ? `（${daysInData} 天）` : ""}`;
}

const ACCENTS = {
  tasks: "var(--chart-1)",
  verified: "var(--chart-2)",
  failed: "var(--chart-5)",
  targets: "var(--chart-3)",
  awaiting: "var(--chart-4)",
  pending: "var(--chart-3)",
} as const;

const tasksConfig = {
  tasks: { label: "任务", color: ACCENTS.tasks },
} satisfies ChartConfig;

const outcomeConfig = {
  verified: { label: "成功", color: ACCENTS.verified },
  failed: { label: "失败", color: ACCENTS.failed },
} satisfies ChartConfig;

export function AnalyticsPage() {
  const [mode, setMode] = useState<RangeMode>({ kind: "preset", days: 30 });
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const query = useMemo(() => queryFromMode(mode), [mode]);
  const { data, isLoading, isFetching, refetch } = useQuery(analyticsOptions(query));

  const dailyChart = useMemo(
    () =>
      (data?.daily ?? []).map((row) => ({
        date: row.date,
        tasks: row.tasks,
        verified: row.verified,
        failed: row.failed,
      })),
    [data?.daily],
  );

  const platformRank = useMemo(() => {
    const rows = [...(data?.byPlatform ?? [])];
    rows.sort((a, b) => b.targets - a.targets);
    return rows;
  }, [data?.byPlatform]);

  const accountRank = useMemo(() => {
    const rows = [...(data?.byAccount ?? [])];
    rows.sort((a, b) => b.verified - a.verified || b.targets - a.targets);
    return rows;
  }, [data?.byAccount]);

  const successPct =
    data?.successRate == null ? null : Math.round(Math.max(0, Math.min(1, data.successRate)) * 100);

  const gauges = useMemo(
    () =>
      accountRank.slice(0, 8).map((row, index) => {
        const rate = row.targets > 0 ? Math.round((row.verified / row.targets) * 100) : 0;
        const colors = [
          ACCENTS.tasks,
          ACCENTS.verified,
          ACCENTS.awaiting,
          ACCENTS.failed,
          ACCENTS.targets,
        ];
        return {
          key: row.accountId,
          label: row.name,
          sublabel: platformInfo[row.platform]?.label ?? row.platform,
          value: rate,
          color: colors[index % colors.length],
        };
      }),
    [accountRank],
  );

  return (
    <DocumentPage>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 overflow-auto px-8 py-6">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">数据分析</h1>
            <p className="text-sm text-muted-foreground">本机发布汇总（不抓取平台阅读/点赞）</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-card p-0.5 ring-1 ring-border">
              {[7, 30, 90].map((value) => (
                <Button
                  key={value}
                  variant={mode.kind === "preset" && mode.days === value ? "default" : "ghost"}
                  size="sm"
                  className="rounded-md"
                  onClick={() => setMode({ kind: "preset", days: value })}
                >
                  {value} 天
                </Button>
              ))}
            </div>
            <Popover
              open={rangeOpen}
              onOpenChange={(open) => {
                setRangeOpen(open);
                if (open) {
                  if (mode.kind === "custom") {
                    setDraftRange({
                      from: new Date(`${mode.from}T00:00:00`),
                      to: new Date(`${mode.to}T00:00:00`),
                    });
                  } else {
                    const end = new Date();
                    end.setHours(0, 0, 0, 0);
                    const start = new Date(end);
                    start.setDate(end.getDate() - (mode.days - 1));
                    setDraftRange({ from: start, to: end });
                  }
                }
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant={mode.kind === "custom" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                  >
                    <CalendarIcon className="size-3.5" />
                    {mode.kind === "custom" ? rangeLabel(mode) : "自定义"}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  locale={zhCN}
                  numberOfMonths={2}
                  selected={draftRange}
                  onSelect={setDraftRange}
                  disabled={{ after: new Date() }}
                  defaultMonth={draftRange?.from}
                />
                <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                  <p className="text-xs text-muted-foreground">最多 366 天 · 含首尾两天</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRangeOpen(false)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      disabled={!draftRange?.from || !draftRange?.to}
                      onClick={() => {
                        if (!draftRange?.from || !draftRange?.to) return;
                        setMode({
                          kind: "custom",
                          from: toDayString(draftRange.from),
                          to: toDayString(draftRange.to),
                        });
                        setRangeOpen(false);
                      }}
                    >
                      应用
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCwIcon className={cn("size-3.5", isFetching && "animate-spin")} />
              刷新
            </Button>
          </div>
        </div>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : (
          <>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                icon={SendIcon}
                label="任务数"
                value={String(data.totals.tasks)}
                accent={ACCENTS.tasks}
              />
              <MetricCard
                icon={TargetIcon}
                label="目标数"
                value={String(data.totals.targets)}
                accent={ACCENTS.targets}
              />
              <MetricCard
                icon={CircleCheckIcon}
                label="成功率"
                value={successPct == null ? "—" : `${successPct}%`}
                hint={`成功 ${data.totals.verified} · 失败 ${data.totals.failed}`}
                accent={ACCENTS.verified}
              />
              <MetricCard
                icon={ClockIcon}
                label="待处理"
                value={String(data.totals.awaitingUser)}
                accent={ACCENTS.awaiting}
              />
              <MetricCard
                icon={LoaderCircleIcon}
                label="进行中"
                value={String(data.totals.pendingOrRunning)}
                accent={ACCENTS.pending}
              />
              <MetricCard
                icon={ChartColumnIcon}
                label="排期中"
                value={String(data.totals.scheduled)}
                accent={ACCENTS.failed}
              />
            </div>

            <AnalyticsSection
              title="任务趋势"
              description={`${rangeLabel(mode, data.days)}每日创建的发布任务`}
              chart={
                !dailyChart.length ? (
                  <ChartEmpty />
                ) : (
                  <EvilGradientAreaChart
                    data={dailyChart}
                    config={tasksConfig}
                    series={[{ dataKey: "tasks", color: ACCENTS.tasks }]}
                    heightClassName="h-52"
                  />
                )
              }
              rankTitle="平台排行"
              rankDescription="按目标数"
              rank={
                !platformRank.length ? (
                  <ChartEmpty compact />
                ) : (
                  <RankTable
                    rows={platformRank.map((row, index) => ({
                      key: row.platform,
                      rank: index + 1,
                      platform: row.platform,
                      name: platformInfo[row.platform]?.label ?? row.platform,
                      cols: [
                        { label: "目标", value: row.targets },
                        { label: "成功", value: row.verified },
                        { label: "失败", value: row.failed },
                        {
                          label: "成功率",
                          value:
                            row.targets > 0
                              ? `${Math.round((row.verified / row.targets) * 100)}%`
                              : "—",
                        },
                      ],
                    }))}
                  />
                )
              }
            />

            <AnalyticsSection
              title="成败趋势"
              description="每日成功与失败目标数"
              chart={
                !dailyChart.length ? (
                  <ChartEmpty />
                ) : (
                  <EvilGradientAreaChart
                    data={dailyChart}
                    config={outcomeConfig}
                    series={[
                      { dataKey: "verified", color: ACCENTS.verified },
                      { dataKey: "failed", color: ACCENTS.failed },
                    ]}
                    heightClassName="h-52"
                  />
                )
              }
              rankTitle="账号排行"
              rankDescription="按成功目标数"
              rank={
                !accountRank.length ? (
                  <ChartEmpty compact />
                ) : (
                  <RankTable
                    rows={accountRank.map((row, index) => ({
                      key: row.accountId,
                      rank: index + 1,
                      platform: row.platform,
                      name: row.name,
                      cols: [
                        { label: "目标", value: row.targets },
                        { label: "成功", value: row.verified },
                        { label: "失败", value: row.failed },
                        {
                          label: "成功率",
                          value:
                            row.targets > 0
                              ? `${Math.round((row.verified / row.targets) * 100)}%`
                              : "—",
                        },
                      ],
                    }))}
                  />
                )
              }
            />

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <Card className="min-w-0 bg-card shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle>发布完成度</CardTitle>
                  <CardDescription>成功目标占全部目标的比例</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-3xl font-semibold tracking-tight tabular-nums">
                        {data.totals.verified}
                        <span className="ml-1 text-base font-normal text-muted-foreground">
                          / {data.totals.targets}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">已成功验证的目标</p>
                    </div>
                    <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-[color:var(--chart-2)]">
                      {successPct == null ? "—" : `${successPct}%`}
                    </p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${successPct ?? 0}%`,
                        background: `linear-gradient(90deg, ${ACCENTS.verified}, color-mix(in oklab, ${ACCENTS.verified} 55%, white))`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 bg-card shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle>账号健康度</CardTitle>
                  <CardDescription>各账号成功率（最多 8 个）</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 pt-5">
                  {!gauges.length ? (
                    <ChartEmpty compact />
                  ) : (
                    <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4">
                      {gauges.map((g) => (
                        <RadialGauge
                          key={g.key}
                          value={g.value}
                          label={g.label}
                          sublabel={g.sublabel}
                          color={g.color}
                          className="min-w-0"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DocumentPage>
  );
}

function AnalyticsSection({
  title,
  description,
  chart,
  rankTitle,
  rankDescription,
  rank,
}: {
  title: string;
  description: string;
  chart: ReactNode;
  rankTitle: string;
  rankDescription: string;
  rank: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card className="min-w-0 bg-card shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 pt-4">{chart}</CardContent>
      </Card>
      <Card className="min-w-0 bg-card shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>{rankTitle}</CardTitle>
          <CardDescription>{rankDescription}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 pt-2">{rank}</CardContent>
      </Card>
    </div>
  );
}

type RankRow = {
  key: string;
  rank: number;
  platform: PlatformId | string;
  name: string;
  cols: Array<{ label: string; value: string | number }>;
};

function RankTable({ rows }: { rows: RankRow[] }) {
  const headers = rows[0]?.cols.map((c) => c.label) ?? [];
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="w-8 py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">名称</th>
            {headers.map((h) => (
              <th key={h} className="py-2 pl-2 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const icon = platformIcons[row.platform as PlatformId];
            return (
              <tr key={row.key} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {row.rank}
                </td>
                <td className="py-2.5 pr-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlatformBadge platform={row.platform} icon={icon} />
                    <span className="truncate font-medium">{row.name}</span>
                  </div>
                </td>
                {row.cols.map((col) => (
                  <td
                    key={col.label}
                    className="py-2.5 pl-2 text-right font-mono text-xs tabular-nums"
                  >
                    {col.value}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlatformBadge({ platform, icon }: { platform: PlatformId | string; icon?: string }) {
  const label = platformInfo[platform as PlatformId]?.label ?? String(platform);
  return (
    <div className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-white to-muted shadow-sm ring-1 ring-black/10 dark:from-muted dark:to-background dark:ring-white/10">
      {icon ? (
        <img src={icon} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {label.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof SendIcon;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Card size="sm" className="min-w-0 bg-card shadow-sm">
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-1 font-mono text-2xl tracking-tighter tabular-nums">
              {value}
            </CardTitle>
            {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{
              background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 22%, white), color-mix(in oklab, ${accent} 10%, transparent))`,
            }}
          >
            <Icon className="size-4" style={{ color: accent }} />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function ChartEmpty({ compact }: { compact?: boolean }) {
  return (
    <Empty className={cn("border-0", compact ? "py-6" : "py-10")}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ChartColumnIcon />
        </EmptyMedia>
        <EmptyTitle>暂无数据</EmptyTitle>
        <EmptyDescription>发布几条内容后，这里会显示汇总图表。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
