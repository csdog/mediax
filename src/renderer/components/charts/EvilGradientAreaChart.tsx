import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, type DotProps } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "cn";

type SeriesPoint = Record<string, string | number>;

type EvilGradientAreaChartProps = {
  data: SeriesPoint[];
  config: ChartConfig;
  xKey?: string;
  series: Array<{
    dataKey: string;
    /** Solid stroke; fill uses a vertical gradient of the same color. */
    color: string;
  }>;
  className?: string;
  heightClassName?: string;
  curveType?: "natural" | "monotone" | "linear";
  showGrid?: boolean;
  formatX?: (value: string) => string;
};

/**
 * Evil Charts–inspired gradient area: soft fill, natural curve, glow active dots,
 * left-to-right reveal (respects prefers-reduced-motion).
 */
export function EvilGradientAreaChart({
  data,
  config,
  xKey = "date",
  series,
  className,
  heightClassName = "h-56",
  curveType = "natural",
  showGrid = true,
  formatX = (value) => value.slice(5),
}: EvilGradientAreaChartProps) {
  const reactId = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const maskId = `${reactId}-reveal`;

  const yMax = useMemo(() => {
    let max = 0;
    for (const row of data) {
      for (const s of series) {
        const n = Number(row[s.dataKey] ?? 0);
        if (n > max) max = n;
      }
    }
    return Math.max(max, 1);
  }, [data, series]);

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full min-w-0", heightClassName, className)}
    >
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.dataKey}
              id={`${reactId}-fill-${s.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
              <stop offset="55%" stopColor={s.color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
          <filter id={`${reactId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {!reduceMotion ? (
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="100%"
              height="100%"
            >
              <motion.rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="white"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: 0 }}
              />
            </mask>
          ) : null}
        </defs>
        {showGrid ? (
          <CartesianGrid vertical={false} strokeDasharray="3 6" className="stroke-border/50" />
        ) : null}
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={formatX}
          className="text-[11px]"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
          domain={[0, yMax]}
          className="text-[11px]"
        />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <g style={reduceMotion ? undefined : { mask: `url(#${maskId})` }}>
          {series.map((s) => (
            <Area
              key={s.dataKey}
              type={curveType}
              dataKey={s.dataKey}
              stroke={s.color}
              strokeWidth={2.25}
              fill={`url(#${reactId}-fill-${s.dataKey})`}
              isAnimationActive={false}
              activeDot={(props: DotProps) => (
                <GlowDot {...props} color={s.color} filterId={`${reactId}-glow`} />
              )}
              dot={false}
            />
          ))}
        </g>
      </AreaChart>
    </ChartContainer>
  );
}

function GlowDot({ cx, cy, color, filterId }: DotProps & { color: string; filterId: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g filter={`url(#${filterId})`}>
      <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.22} />
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="var(--card)" strokeWidth={2} />
    </g>
  );
}
