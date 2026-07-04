import { useAnimatedNumber } from "@/lib/use-animated-number";

interface MetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  delta?: number;
  tone?: "primary" | "accent" | "warning" | "destructive" | "secondary";
  sublabel?: string;
}

const TONE: Record<string, { text: string; bar: string; glow: string }> = {
  primary: {
    text: "text-[oklch(0.72_0.18_245)]",
    bar: "bg-[oklch(0.72_0.18_245)]",
    glow: "shadow-[0_0_30px_-8px_oklch(0.72_0.18_245/0.6)]",
  },
  accent: {
    text: "text-[oklch(0.85_0.21_145)]",
    bar: "bg-[oklch(0.85_0.21_145)]",
    glow: "shadow-[0_0_30px_-8px_oklch(0.85_0.21_145/0.6)]",
  },
  warning: {
    text: "text-[oklch(0.82_0.17_75)]",
    bar: "bg-[oklch(0.82_0.17_75)]",
    glow: "shadow-[0_0_30px_-8px_oklch(0.82_0.17_75/0.6)]",
  },
  destructive: {
    text: "text-[oklch(0.68_0.24_25)]",
    bar: "bg-[oklch(0.68_0.24_25)]",
    glow: "shadow-[0_0_30px_-8px_oklch(0.68_0.24_25/0.6)]",
  },
  secondary: {
    text: "text-[oklch(0.82_0.14_200)]",
    bar: "bg-[oklch(0.82_0.14_200)]",
    glow: "shadow-[0_0_30px_-8px_oklch(0.82_0.14_200/0.6)]",
  },
};

export function MetricCard({
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  delta,
  tone = "primary",
  sublabel,
}: MetricCardProps) {
  const animated = useAnimatedNumber(value);
  const t = TONE[tone];

  return (
    <div className={`panel p-4 relative overflow-hidden ${t.glow}`}>
      <div className="absolute inset-x-0 top-0 h-px animate-shimmer" />
      <div className="hud-label mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-display font-semibold tabular-nums ${t.text} text-glow-primary`}
        >
          {prefix}
          {animated.toFixed(decimals)}
          {suffix}
        </span>
        {delta !== undefined && (
          <span
            className={`text-[11px] font-mono ${delta >= 0 ? "text-[oklch(0.85_0.21_145)]" : "text-[oklch(0.68_0.24_25)]"}`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {sublabel && (
        <div className="text-[11px] text-muted-foreground font-mono mt-1">{sublabel}</div>
      )}
      <div className="mt-3 h-1 rounded-full bg-[oklch(0.3_0.03_255/0.6)] overflow-hidden">
        <div
          className={`h-full ${t.bar}`}
          style={{ width: `${Math.min(100, Math.max(8, value))}%` }}
        />
      </div>
    </div>
  );
}
