import { useState } from "react";
import { STATES, type StateData } from "@/lib/grid-data";

function riskColor(risk: number) {
  if (risk >= 70) return { fill: "oklch(0.68 0.24 25)", glow: "oklch(0.68 0.24 25 / 0.6)" };
  if (risk >= 45) return { fill: "oklch(0.82 0.17 75)", glow: "oklch(0.82 0.17 75 / 0.55)" };
  if (risk >= 30) return { fill: "oklch(0.82 0.14 200)", glow: "oklch(0.82 0.14 200 / 0.55)" };
  return { fill: "oklch(0.85 0.21 145)", glow: "oklch(0.85 0.21 145 / 0.55)" };
}

// Approximate India outline (stylized, decorative — not survey-accurate)
const INDIA_PATH =
  "M310,90 C360,80 420,95 470,110 C520,120 560,110 600,130 C640,150 700,200 720,260 C740,310 720,360 690,380 C660,400 620,420 600,460 C590,500 600,540 580,570 C560,600 520,610 490,640 C470,680 460,720 430,760 C410,790 380,800 360,780 C340,750 350,710 340,680 C320,640 290,610 280,560 C270,510 290,470 280,420 C270,370 240,340 250,290 C260,240 280,180 280,140 C280,110 290,95 310,90 Z";

interface Props {
  data?: StateData[];
  height?: number;
  showLabels?: boolean;
  interactive?: boolean;
}

export function IndiaMap({
  data = STATES,
  height = 640,
  showLabels = true,
  interactive = true,
}: Props) {
  const [hover, setHover] = useState<StateData | null>(null);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Grid backdrop */}
      <div className="absolute inset-0 grid-bg opacity-60 rounded-2xl" />
      {/* Radial scanner */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ width: 480, height: 480 }}
      >
        <div
          className="absolute inset-0 rounded-full animate-sweep"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, oklch(0.72 0.18 245 / 0.18) 30deg, transparent 60deg)",
          }}
        />
        <div className="absolute inset-0 rounded-full border border-[oklch(0.72_0.18_245/0.15)]" />
        <div className="absolute inset-8 rounded-full border border-[oklch(0.72_0.18_245/0.12)]" />
        <div className="absolute inset-16 rounded-full border border-[oklch(0.72_0.18_245/0.08)]" />
      </div>

      <svg
        viewBox="0 0 1000 900"
        className="relative w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="india-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.18 245 / 0.10)" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 200 / 0.04)" />
          </linearGradient>
          <linearGradient id="link-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.72 0.18 245 / 0)" />
            <stop offset="50%" stopColor="oklch(0.72 0.18 245 / 0.6)" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 200 / 0)" />
          </linearGradient>
        </defs>

        {/* India silhouette */}
        <path
          d={INDIA_PATH}
          fill="url(#india-fill)"
          stroke="oklch(0.72 0.18 245 / 0.45)"
          strokeWidth="1.2"
        />
        <path
          d={INDIA_PATH}
          fill="none"
          stroke="oklch(0.82 0.14 200 / 0.5)"
          strokeWidth="0.8"
          className="animate-dash"
        />

        {/* Transmission links between high-load states — live power flows */}
        {[
          ["DL", "UP"],
          ["DL", "HR"],
          ["DL", "PB"],
          ["UP", "BR"],
          ["BR", "WB"],
          ["MH", "GJ"],
          ["MH", "MP"],
          ["MH", "KA"],
          ["KA", "TN"],
          ["KA", "AP"],
          ["AP", "TS"],
          ["TS", "MP"],
          ["RJ", "GJ"],
          ["RJ", "MP"],
          ["MP", "UP"],
          ["WB", "OD"],
          ["OD", "AP"],
          ["TN", "KL"],
        ].map(([a, b], i) => {
          const sa = data.find((s) => s.id === a);
          const sb = data.find((s) => s.id === b);
          if (!sa || !sb) return null;
          // Flow direction: from lower-risk (surplus) to higher-risk (deficit)
          const fromSurplus = sa.risk <= sb.risk ? sa : sb;
          const toDeficit = sa.risk <= sb.risk ? sb : sa;
          const load = Math.min(1, (sa.demand + sb.demand) / 50);
          const stress = Math.max(sa.risk, sb.risk);
          const flowColor =
            stress >= 70
              ? "oklch(0.68 0.24 25)"
              : stress >= 45
                ? "oklch(0.82 0.17 75)"
                : "oklch(0.85 0.21 145)";
          const pathD = `M${fromSurplus.x},${fromSurplus.y} L${toDeficit.x},${toDeficit.y}`;
          const dur = 3 + (1 - load) * 4; // higher load = faster photons
          return (
            <g key={i}>
              <path
                d={pathD}
                stroke="url(#link-grad)"
                strokeWidth={0.8 + load * 0.8}
                fill="none"
                opacity={0.4 + load * 0.4}
              />
              {/* power-flow photon — directional */}
              <circle
                r={1.2 + load * 1.2}
                fill={flowColor}
                opacity="0.95"
                style={{ filter: `drop-shadow(0 0 4px ${flowColor})` }}
              >
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={pathD} />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                />
              </circle>
              {load > 0.5 && (
                <circle r="0.8" fill="oklch(1 0 0)" opacity="0.9">
                  <animateMotion
                    dur={`${dur}s`}
                    begin={`${dur / 2}s`}
                    repeatCount="indefinite"
                    path={pathD}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* State nodes */}
        {data.map((s) => {
          const c = riskColor(s.risk);
          const r = 6 + Math.min(s.demand, 30) / 4;
          return (
            <g
              key={s.id}
              onMouseEnter={() => interactive && setHover(s)}
              onMouseLeave={() => interactive && setHover(null)}
              style={{ cursor: interactive ? "pointer" : "default" }}
            >
              {/* Pulse ring */}
              <circle cx={s.x} cy={s.y} r={r} fill={c.fill} opacity="0.18">
                <animate
                  attributeName="r"
                  values={`${r};${r * 2.4};${r}`}
                  dur={`${2 + (s.risk % 7) * 0.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur={`${2 + (s.risk % 7) * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={s.x}
                cy={s.y}
                r={r}
                fill={c.fill}
                filter="url(#glow)"
                stroke="oklch(1 0 0 / 0.4)"
                strokeWidth="0.6"
              />
              {showLabels && (
                <text
                  x={s.x + r + 6}
                  y={s.y + 4}
                  fill="oklch(0.86 0.02 250)"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  opacity="0.85"
                >
                  {s.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover overlay */}
      {hover && (
        <div
          className="absolute z-20 panel panel-glow p-4 w-72 animate-fade-up pointer-events-none"
          style={{
            left: `min(calc(${(hover.x / 1000) * 100}% + 16px), calc(100% - 19rem))`,
            top: `min(calc(${(hover.y / 900) * 100}% - 20px), calc(100% - 13rem))`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="hud-label">State</div>
              <div className="text-base font-semibold">{hover.name}</div>
            </div>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono"
              style={{
                background: riskColor(hover.risk).fill + "20",
                color: riskColor(hover.risk).fill,
                border: `1px solid ${riskColor(hover.risk).fill}`,
              }}
            >
              RISK {hover.risk}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs font-mono">
            <Row k="Demand" v={`${hover.demand.toFixed(1)} GW`} />
            <Row k="Forecast" v={`${hover.forecast.toFixed(1)} GW`} />
            <Row k="Renewable" v={`${hover.renewable.toFixed(1)} GW`} />
            <Row k="Battery" v={`${hover.battery}%`} />
            <Row k="Blackout P" v={`${hover.blackout}%`} />
            <Row
              k="Grid"
              v={hover.risk >= 70 ? "STRESS" : hover.risk >= 45 ? "WATCH" : "NOMINAL"}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-[oklch(0.72_0.18_245/0.18)]">
            <div className="hud-label mb-1">AI Recommendation</div>
            <div className="text-xs text-foreground/90">{hover.recommendation}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 panel px-3 py-2 text-[10px] font-mono flex gap-3">
        <LegendDot color="oklch(0.85 0.21 145)" label="NOMINAL" />
        <LegendDot color="oklch(0.82 0.14 200)" label="ELEVATED" />
        <LegendDot color="oklch(0.82 0.17 75)" label="WATCH" />
        <LegendDot color="oklch(0.68 0.24 25)" label="CRITICAL" />
      </div>
      <div className="absolute top-3 right-3 panel px-3 py-1.5 text-[10px] font-mono text-muted-foreground flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
        LIVE TELEMETRY · {data.length} NODES
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="text-muted-foreground">{k}</div>
      <div className="text-right">{v}</div>
    </>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}
