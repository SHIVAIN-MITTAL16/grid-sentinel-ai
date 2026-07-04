import { FORECAST_HORIZONS } from "@/lib/grid-data";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const RISK_MAP: Record<string, number> = {
  Now: 41,
  "+6h": 58,
  "+12h": 72,
  "+24h": 64,
  "+48h": 47,
};

export function ForecastTimeline({ value, onChange }: Props) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="hud-label">Forecast horizon</div>
          <div className="text-sm font-display">Risk projection timeline</div>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          PROJECTED RISK · {RISK_MAP[value]}
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[oklch(0.72_0.18_245/0.2)]" />
        <div
          className="absolute left-0 top-1/2 h-px bg-[oklch(0.72_0.18_245)] shadow-[0_0_8px_oklch(0.72_0.18_245)]"
          style={{
            width: `${(FORECAST_HORIZONS.indexOf(value as never) / (FORECAST_HORIZONS.length - 1)) * 100}%`,
          }}
        />
        <div className="relative flex justify-between">
          {FORECAST_HORIZONS.map((h) => {
            const active = h === value;
            return (
              <button
                key={h}
                onClick={() => onChange(h)}
                className="flex flex-col items-center gap-2 group"
              >
                <span
                  className={`w-3 h-3 rounded-full border transition-all ${
                    active
                      ? "bg-[oklch(0.72_0.18_245)] border-[oklch(0.72_0.18_245)] shadow-[0_0_16px_oklch(0.72_0.18_245)] scale-125"
                      : "bg-[oklch(0.14_0.025_260)] border-[oklch(0.72_0.18_245/0.5)] group-hover:border-[oklch(0.72_0.18_245)]"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] ${active ? "text-[oklch(0.72_0.18_245)]" : "text-muted-foreground"}`}
                >
                  {h}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{RISK_MAP[h]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
