import { cn } from "cn";

type RadialGaugeProps = {
  value: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
  className?: string;
};

/** Compact ring gauge (蚁小二–style account health). `value` is 0–100. */
export function RadialGauge({
  value,
  label,
  sublabel,
  color = "var(--chart-1)",
  size = 72,
  className,
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-semibold tabular-nums tracking-tight">
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <p className="max-w-20 truncate text-center text-xs font-medium leading-tight">{label}</p>
      {sublabel ? (
        <p className="max-w-20 truncate text-center text-[11px] text-muted-foreground">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}
