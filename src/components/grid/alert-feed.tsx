import { useEffect, useState } from "react";
import { SEED_ALERTS, type Alert } from "@/lib/grid-data";
import { AlertTriangle, AlertOctagon, Info, CheckCircle2 } from "lucide-react";

const POOL: Omit<Alert, "id" | "time">[] = [
  {
    level: "critical",
    state: "Maharashtra",
    title: "Frequency dip detected",
    detail: "49.71 Hz on western corridor — auto load-shed armed",
  },
  {
    level: "warning",
    state: "Punjab",
    title: "Thermal plant ramp delay",
    detail: "Bathinda Unit 3 ramp 80 MW/min vs 110 expected",
  },
  {
    level: "info",
    state: "Karnataka",
    title: "AI dispatch optimization",
    detail: "Switched 240 MW from gas → battery (cost −₹4.2L/hr)",
  },
  {
    level: "warning",
    state: "Tamil Nadu",
    title: "Wind curtailment risk",
    detail: "Forecast +1.6 GW exceeds evacuation capacity",
  },
  {
    level: "critical",
    state: "Delhi",
    title: "Transformer T-44 thermal",
    detail: "Oil temp 84°C — secondary cooling engaged",
  },
  {
    level: "ok",
    state: "Gujarat",
    title: "Storage cycle complete",
    detail: "Kutch BESS @ 96% SoC, ready for evening peak",
  },
  {
    level: "info",
    state: "Andhra Pradesh",
    title: "Pumped hydro charging",
    detail: "Srisailam reversed flow — 540 MW absorbed",
  },
];

function ts() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

const LEVEL = {
  critical: { Icon: AlertOctagon, color: "oklch(0.68 0.24 25)", label: "CRITICAL" },
  warning: { Icon: AlertTriangle, color: "oklch(0.82 0.17 75)", label: "WARNING" },
  info: { Icon: Info, color: "oklch(0.82 0.14 200)", label: "INFO" },
  ok: { Icon: CheckCircle2, color: "oklch(0.85 0.21 145)", label: "NOMINAL" },
} as const;

export function AlertFeed({ maxItems = 8 }: { maxItems?: number }) {
  const [alerts, setAlerts] = useState<Alert[]>(SEED_ALERTS);

  useEffect(() => {
    const i = setInterval(() => {
      const next = POOL[Math.floor(Math.random() * POOL.length)];
      setAlerts((cur) =>
        [{ ...next, id: crypto.randomUUID(), time: ts() }, ...cur].slice(0, maxItems),
      );
    }, 4200);
    return () => clearInterval(i);
  }, [maxItems]);

  return (
    <div className="panel p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="hud-label">Operational alert feed</div>
          <div className="text-sm font-display">Live command stream</div>
        </div>
        <span className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.68_0.24_25)] animate-flicker" />
          BROADCASTING
        </span>
      </div>
      <div className="flex-1 overflow-hidden space-y-2">
        {alerts.slice(0, maxItems).map((a) => {
          const L = LEVEL[a.level];
          return (
            <div
              key={a.id}
              className="animate-slide-in flex gap-3 p-3 rounded-lg border border-[oklch(0.72_0.18_245/0.1)] bg-[oklch(0.16_0.028_260/0.5)]"
              style={{ borderLeft: `3px solid ${L.color}` }}
            >
              <L.Icon size={18} style={{ color: L.color }} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span style={{ color: L.color }}>{L.label}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{a.state.toUpperCase()}</span>
                  <span className="text-muted-foreground ml-auto">{a.time}</span>
                </div>
                <div className="text-sm font-medium mt-0.5 truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground truncate">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
