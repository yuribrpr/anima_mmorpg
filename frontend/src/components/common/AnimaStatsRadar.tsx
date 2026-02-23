import { useId } from "react";
import { cn } from "@/lib/utils";

export type RadarMetric = {
  key: string;
  label: string;
  value: number;
  max: number;
  displayValue?: string;
};

type AnimaStatsRadarProps = {
  metrics: RadarMetric[];
  className?: string;
  title?: string;
  size?: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toPoint = (index: number, total: number, ratio: number, center: number, radius: number) => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(total, 1);
  const x = center + Math.cos(angle) * radius * ratio;
  const y = center + Math.sin(angle) * radius * ratio;
  return { x, y };
};

export const AnimaStatsRadar = ({ metrics, className, title = "Radar de status", size = 244 }: AnimaStatsRadarProps) => {
  const gradientId = useId();
  const center = size / 2;
  const radius = size * 0.34;
  const levels = [0.25, 0.5, 0.75, 1];

  const normalized = metrics.map((metric) => {
    const safeMax = Math.max(metric.max, 1);
    return clamp(metric.value / safeMax, 0, 1);
  });

  const polygonPoints = normalized
    .map((ratio, index) => {
      const { x, y } = toPoint(index, metrics.length, ratio, center, radius);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-3", className)}>
      <p className="mb-2 text-sm font-medium">{title}</p>

      <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[220px] w-[220px]">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(var(--ring))" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {levels.map((level) => {
            const points = metrics
              .map((_, index) => {
                const { x, y } = toPoint(index, metrics.length, level, center, radius);
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <polygon
                key={level}
                points={points}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={level === 1 ? 1.4 : 1}
                strokeOpacity={level === 1 ? 1 : 0.7}
              />
            );
          })}

          {metrics.map((metric, index) => {
            const outer = toPoint(index, metrics.length, 1, center, radius);
            const label = toPoint(index, metrics.length, 1.16, center, radius);
            const textAnchor = label.x < center - 6 ? "end" : label.x > center + 6 ? "start" : "middle";

            return (
              <g key={metric.key}>
                <line x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={label.x} y={label.y} textAnchor={textAnchor} dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
                  {metric.label}
                </text>
              </g>
            );
          })}

          {polygonPoints ? <polygon points={polygonPoints} fill={`url(#${gradientId})`} stroke="hsl(var(--primary))" strokeWidth={2} /> : null}

          {normalized.map((ratio, index) => {
            const point = toPoint(index, metrics.length, ratio, center, radius);
            return <circle key={metrics[index]?.key ?? index} cx={point.x} cy={point.y} r={3.1} fill="hsl(var(--primary))" />;
          })}
        </svg>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-md border border-border bg-card/70 px-2 py-1.5">
              <p className="text-muted-foreground">{metric.label}</p>
              <p className="font-medium">{metric.displayValue ?? metric.value.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
