import { useAnimatedNumber } from "@/lib/use-animated-number";

interface MixEntry {
  label: string;
  pct: number;
  color: string;
}

export function AIRecommendationPanel({
  mix,
  reliability = 99.4,
  costReduction = 12.6,
  carbonReduction = 18.2,
}: {
  mix?: MixEntry[];
  reliability?: number;
  costReduction?: number;
  carbonReduction?: number;
}) {
  const defaults: MixEntry[] = [
    { label: "Solar", pct: 32, color: "oklch(0.85 0.21 145)" },
    { label: "Wind", pct: 24, color: "oklch(0.82 0.14 200)" },
    { label: "Battery", pct: 14, color: "oklch(0.72 0.18 245)" },
    { label: "Gas", pct: 18, color: "oklch(0.82 0.17 75)" },
    { label: "Coal", pct: 12, color: "oklch(0.55 0.04 260)" },
  ];
  const data = mix ?? defaults;
  const rel = useAnimatedNumber(reliability);
  const cost = useAnimatedNumber(costReduction);
  const carbon = useAnimatedNumber(carbonReduction);

  return (
    <div className="panel panel-glow p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="hud-label">AI dispatch recommendation</div>
          <div className="text-base font-display">Optimal energy mix · next 60 min</div>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 rounded border border-[oklch(0.85_0.21_145/0.4)] text-[oklch(0.85_0.21_145)]">
          MODEL v7.3 · CONF 96%
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-3 border border-[oklch(0.72_0.18_245/0.2)]">
        {data.map((d) => (
          <div
            key={d.label}
            style={{ width: `${d.pct}%`, background: d.color }}
            className="h-full"
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 mb-5">
        {data.map((d) => (
          <div key={d.label} className="text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.label.toUpperCase()}</span>
            </div>
            <div className="text-sm font-display tabular-nums mt-0.5">{d.pct}%</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Outcome label="Expected reliability" value={rel.toFixed(2)} suffix="%" tone="accent" />
        <Outcome label="Cost reduction" value={cost.toFixed(1)} suffix="%" tone="primary" />
        <Outcome label="Carbon reduction" value={carbon.toFixed(1)} suffix="%" tone="secondary" />
      </div>
    </div>
  );
}

function Outcome({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix: string;
  tone: "accent" | "primary" | "secondary";
}) {
  const color =
    tone === "accent"
      ? "oklch(0.85 0.21 145)"
      : tone === "primary"
        ? "oklch(0.72 0.18 245)"
        : "oklch(0.82 0.14 200)";
  return (
    <div className="rounded-lg p-3 bg-[oklch(0.16_0.028_260/0.7)] border border-[oklch(0.72_0.18_245/0.12)]">
      <div className="hud-label mb-1">{label}</div>
      <div
        className="text-xl font-display tabular-nums"
        style={{ color, textShadow: `0 0 18px ${color}55` }}
      >
        {value}
        {suffix}
      </div>
    </div>
  );
}
