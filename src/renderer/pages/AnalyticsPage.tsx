import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Rectangle, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { ChartColumnIcon, CircleCheckIcon, ClockIcon, SendIcon } from "lucide-react";
import { HoverTraceBarChart } from "@/components/charts/HoverTraceBarChart";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { analyticsOptions } from "@/app/queries";
import { platformIcons } from "@/assets/platformIcons";
import { platformInfo } from "../../shared/platforms";
import type { PlatformId } from "../../shared/models";

const dailyConfig = {
  tasks: { label: "任务", color: "var(--chart-1)" },
} satisfies ChartConfig;

const platformConfig = {
  targets: { label: "目标", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery(analyticsOptions(days));

  const dailyPoints = useMemo(
    () => (data?.daily ?? []).map((row) => ({ label: row.date, value: row.tasks })),
    [data?.daily],
  );

  const platformChart = useMemo(
    () =>
      (data?.byPlatform ?? []).map((row) => ({
        platform: platformInfo[row.platform]?.label ?? row.platform,
        targets: row.targets,
      })),
    [data?.byPlatform],
  );

  return (
    <DocumentPage>
      <div className="flex h-full flex-col gap-4 overflow-auto p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">数据分析</h1>
            <p className="text-sm text-muted-foreground">本机发布汇总（不抓取平台阅读/点赞）</p>
          </div>
          <div className="flex rounded-lg bg-muted p-0.5">
            {[7, 30, 90].map((value) => (
              <Button
                key={value}
                variant={days === value ? "default" : "ghost"}
                size="sm"
                className="rounded-md"
                onClick={() => setDays(value)}
              >
                {value} 天
              </Button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={SendIcon}
                label="任务数"
                value={String(data.totals.tasks)}
                accent="var(--chart-1)"
              />
              <MetricCard
                icon={ChartColumnIcon}
                label="目标数"
                value={String(data.totals.targets)}
                accent="var(--chart-2)"
              />
              <MetricCard
                icon={CircleCheckIcon}
                label="成功率"
                value={data.successRate == null ? "—" : `${Math.round(data.successRate * 100)}%`}
                hint={`成功 ${data.totals.verified} · 失败 ${data.totals.failed}`}
                accent="var(--chart-3)"
              />
              <MetricCard
                icon={ClockIcon}
                label="待处理 / 排期"
                value={`${data.totals.awaitingUser} / ${data.totals.scheduled}`}
                hint={`进行中 ${data.totals.pendingOrRunning}`}
                accent="var(--chart-4)"
              />
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle>每日任务量</CardTitle>
                <CardDescription>悬停查看对应日期 · 近 {days} 天</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {!dailyPoints.length ? (
                  <ChartEmpty />
                ) : (
                  <HoverTraceBarChart
                    data={dailyPoints}
                    config={dailyConfig}
                    dataKey="tasks"
                    valueLabel="任务数"
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle>按平台</CardTitle>
                  <CardDescription>圆角柱 · 悬停高亮</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {!platformChart.length ? (
                    <ChartEmpty />
                  ) : (
                    <RoundedHoverBarChart data={platformChart} config={platformConfig} />
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle>按账号</CardTitle>
                  <CardDescription>账号维度目标与成败</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {!data.byAccount.length ? (
                    <ChartEmpty />
                  ) : (
                    <ul className="divide-y">
                      {data.byAccount.map((row) => {
                        const icon = platformIcons[row.platform as PlatformId];
                        const total = Math.max(row.targets, 1);
                        const ok = Math.round((row.verified / total) * 100);
                        return (
                          <li
                            key={row.accountId}
                            className="flex items-center gap-3 py-3 first:pt-1 last:pb-1"
                          >
                            {icon ? (
                              <img
                                src={icon}
                                alt=""
                                className="size-8 shrink-0 rounded-lg ring-1 ring-border"
                              />
                            ) : (
                              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                                <ChartColumnIcon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium">{row.name}</p>
                                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                  {row.targets} 目标
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {platformInfo[row.platform]?.label ?? row.platform}
                                {" · "}成功 {row.verified} · 失败 {row.failed}
                              </p>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-chart-2"
                                  style={{ width: `${ok}%` }}
                                />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
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

function RoundedHoverBarChart({
  data,
  config,
}: {
  data: { platform: string; targets: number }[];
  config: ChartConfig;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const highlighted =
    activeIndex ??
    data.reduce((best, row, index) => (row.targets > data[best].targets ? index : best), 0);

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
        onMouseMove={(state) => {
          if (state?.activeTooltipIndex != null) {
            setActiveIndex(Number(state.activeTooltipIndex));
          }
        }}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis dataKey="platform" type="category" tickLine={false} axisLine={false} width={72} />
        <Tooltip cursor={false} content={() => null} />
        <Bar
          dataKey="targets"
          fill="var(--color-targets)"
          radius={4}
          shape={(props: BarShapeProps) => (
            <HoverOpacityBar {...props} highlightedIndex={highlighted} />
          )}
          activeBar={(props: BarShapeProps) => (
            <HoverOpacityBar {...props} highlightedIndex={highlighted} />
          )}
        />
      </BarChart>
    </ChartContainer>
  );
}

function HoverOpacityBar({
  x,
  y,
  width,
  height,
  fill,
  index,
  isActive,
  highlightedIndex,
  ...rest
}: BarShapeProps & { highlightedIndex: number }) {
  const fillOpacity = isActive || index === highlightedIndex ? 1 : 0.22;
  return (
    <g>
      <Rectangle
        {...rest}
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        pointerEvents="all"
      />
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={4}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={isActive ? "var(--foreground)" : undefined}
        strokeOpacity={isActive ? 0.35 : undefined}
        strokeWidth={isActive ? 1 : undefined}
        className="transition-opacity duration-200"
      />
    </g>
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
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-1 font-mono text-2xl tracking-tighter tabular-nums">
              {value}
            </CardTitle>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)` }}
          >
            <Icon className="size-4" style={{ color: accent }} />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function ChartEmpty() {
  return (
    <Empty className="border-0 py-10">
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
