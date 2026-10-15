import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  Tooltip,
  XAxis,
  type BarShapeProps,
  type CartesianViewBox,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const CHART_MARGIN = 38;

type Point = {
  label: string;
  value: number;
};

type HoverTraceBarChartProps = {
  data: Point[];
  config: ChartConfig;
  dataKey?: string;
  valueLabel?: string;
  className?: string;
  formatValue?: (value: number) => string;
};

export function HoverTraceBarChart({
  data,
  config,
  dataKey = "value",
  valueLabel = "数值",
  className,
  formatValue = (value) => value.toLocaleString(),
}: HoverTraceBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = useMemo(
    () => data.map((row) => ({ label: row.label, [dataKey]: row.value })),
    [data, dataKey],
  );

  const maxData = useMemo(() => {
    type Selected = { index: number; label: string; value: number };
    if (!data.length) return { index: 0, label: "—", value: 0 } satisfies Selected;
    return data.reduce<Selected>(
      (max, item, index) =>
        item.value > max.value ? { index, label: item.label, value: item.value } : max,
      { index: 0, label: data[0].label, value: data[0].value },
    );
  }, [data]);

  const selectedData: { index: number; label: string; value: number } =
    activeIndex != null && data[activeIndex]
      ? {
          index: activeIndex,
          label: data[activeIndex].label,
          value: data[activeIndex].value,
        }
      : maxData;

  const handleBarHover = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (!data.length) return null;

  return (
    <div className={className}>
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{valueLabel}</p>
          <p className="font-mono text-3xl tracking-tighter text-foreground tabular-nums">
            {formatValue(selectedData.value)}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="font-mono text-[10px] text-muted-foreground">日期</p>
          <p className="font-mono text-xs text-foreground">{selectedData.label}</p>
        </div>
      </div>

      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{ left: CHART_MARGIN, right: 12, top: 8 }}
          onMouseMove={(state) => {
            if (state?.activeTooltipIndex != null) {
              handleBarHover(Number(state.activeTooltipIndex));
            }
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(value: string) => (value.length > 5 ? value.slice(5) : value)}
          />
          <Tooltip cursor={false} content={() => null} />
          <Bar
            dataKey={dataKey}
            fill={`var(--color-${dataKey})`}
            radius={4}
            shape={(props: BarShapeProps) => (
              <HoverTraceBarShape {...props} highlightedIndex={selectedData.index} />
            )}
            activeBar={(props: BarShapeProps) => (
              <HoverTraceBarShape {...props} highlightedIndex={selectedData.index} />
            )}
          />
          <ReferenceLine
            y={selectedData.value}
            stroke="var(--foreground)"
            strokeDasharray="3 3"
            strokeOpacity={0.45}
            label={<HoverTraceLabel value={selectedData.value} formatValue={formatValue} />}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function HoverTraceLabel({
  viewBox,
  value,
  formatValue,
}: {
  viewBox?: CartesianViewBox;
  value: number;
  formatValue: (value: number) => string;
}) {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const formatted = formatValue(value);
  const width = Math.max(formatted.length * 8 + 12, 28);

  return (
    <g>
      <rect
        x={x - CHART_MARGIN}
        y={y - 9}
        width={width}
        height={18}
        fill="var(--foreground)"
        rx={4}
      />
      <text
        className="font-mono text-[11px]"
        fontWeight={600}
        x={x - CHART_MARGIN + 7}
        y={y + 4}
        fill="var(--background)"
      >
        {formatted}
      </text>
      <ellipse cx="99.5%" cy={y} rx={3} ry={3} fill="var(--foreground)" />
    </g>
  );
}

function HoverTraceBarShape({
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
  const fillOpacity = isActive || index === highlightedIndex ? 1 : 0.2;

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
