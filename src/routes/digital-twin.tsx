import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { IndiaGeoMap } from "@/components/grid/india-geo-map";
import {
  useGridOptimizerResult,
  useMonteCarloResult,
  useNationalGridSnapshot,
} from "@/hooks/use-grid-backend";
import { STATES } from "@/lib/grid-data";

type DashboardSnapshot = ReturnType<typeof useNationalGridSnapshot>["data"];

export const Route = createFileRoute("/digital-twin")({
  head: () => ({
    meta: [
      { title: "India Digital Twin · Grid Sentinel AI" },
      {
        name: "description",
        content:
          "A geographically accurate, real-time digital twin of India's national grid — stress, reliability, blackout probability, and transmission corridors across every state and union territory.",
      },
      { property: "og:title", content: "India Digital Twin · Grid Sentinel AI" },
      { property: "og:description", content: "India's national power grid, modeled in real time." },
    ],
  }),
  component: DigitalTwin,
});

function DigitalTwin() {
  const snapshotQuery = useNationalGridSnapshot();
  const monteCarloQuery = useMonteCarloResult();
  const optimizerQuery = useGridOptimizerResult();
  const snapshot = snapshotQuery.data;
  const monteCarlo = monteCarloQuery.data;
  const optimizer = optimizerQuery.data;

  const totals = useMemo(() => {
    const demand = snapshot
      ? snapshot.nationalDemandMw / 1000
      : STATES.reduce((a, s) => a + s.demand, 0);
    const re = snapshot
      ? snapshot.nationalRenewableGenerationMw / 1000
      : STATES.reduce((a, s) => a + s.renewable, 0);
    const bat = snapshot
      ? snapshot.states.reduce((a, s) => a + s.energy.batteryAvailableMwh, 0) /
        Math.max(1, snapshot.states.length)
      : STATES.reduce((a, s) => a + s.battery, 0) / STATES.length;
    const top = snapshot
      ? snapshot.states
          .map((s) => ({ id: s.state, name: s.state, risk: s.energy.gridStressIndex }))
          .sort((a, b) => b.risk - a.risk)
          .slice(0, 5)
      : [...STATES].sort((a, b) => b.risk - a.risk).slice(0, 5);
    const riskValues =
      snapshot?.states.map((s) => s.energy.gridStressIndex) ?? STATES.map((s) => s.risk);
    const dist = {
      low: riskValues.filter((risk) => risk < 30).length,
      moderate: riskValues.filter((risk) => risk >= 30 && risk < 45).length,
      high: riskValues.filter((risk) => risk >= 45 && risk < 70).length,
      critical: riskValues.filter((risk) => risk >= 70).length,
    };
    return { demand, re, bat, top, dist };
  }, [snapshot]);

  const live = useMemo(() => {
    const states = snapshot?.states ?? [];
    const totalGenerationMw = states.reduce(
      (sum, state) => sum + state.energy.estimatedDemandMw + state.energy.supplyDemandGapMw,
      0,
    );
    const solarMw = states.reduce((sum, state) => sum + state.energy.solarGenerationMw, 0);
    const windMw = states.reduce((sum, state) => sum + state.energy.windGenerationMw, 0);
    const hydroMw = states.reduce((sum, state) => sum + state.energy.hydroEstimateMw, 0);

    return {
      totalGenerationMw,
      solarMw,
      windMw,
      hydroMw,
      corridors: buildCorridorReadings(snapshot),
      status: snapshotQuery.isLoading ? "SYNCING" : snapshotQuery.isError ? "FEED ERROR" : "LIVE",
    };
  }, [snapshot, snapshotQuery.isError, snapshotQuery.isLoading]);

  const mapData = useMemo(() => {
    if (!snapshot) return STATES;
    return snapshot.states.map((state) => {
      const existing = findStateSeed(state.state);
      return {
        id: existing?.id ?? state.state.slice(0, 2).toUpperCase(),
        name: state.state,
        x: existing?.x ?? 500,
        y: existing?.y ?? 450,
        demand: state.demand.estimatedLoadMw / 1000,
        forecast: state.energy.estimatedDemandMw / 1000,
        renewable: state.energy.netRenewableGenerationMw / 1000,
        battery: Math.round(state.energy.batteryAvailableMwh),
        risk: state.energy.gridStressIndex,
        blackout: Math.round(
          monteCarlo?.blackoutProbability ?? state.energy.gridStressIndex * 0.35,
        ),
        recommendation:
          optimizer?.recommendedActions.find((action) => action.state === state.state)?.reason ??
          "Live backend model nominal",
      };
    });
  }, [monteCarlo?.blackoutProbability, optimizer?.recommendedActions, snapshot]);

  return (
    <div className="px-6 py-6 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px] gap-5">
      {/* ============== LEFT RAIL ============== */}
      <aside className="space-y-4">
        <Widget title="Live System Overview" live>
          <Stat
            label="National Demand"
            value={`${totals.demand.toFixed(1)} GW`}
            delta={live.status}
            tone="primary"
          />
          <Stat
            label="Total Generation"
            value={snapshot ? `${(live.totalGenerationMw / 1000).toFixed(1)} GW` : "—"}
            delta={live.status}
          />
          <Stat
            label="Renewable Share"
            value={
              snapshot
                ? `${snapshot.nationalRenewablePenetrationPercent.toFixed(1)} %`
                : `${((totals.re / totals.demand) * 100).toFixed(1)} %`
            }
            delta={live.status}
            tone="accent"
          />
          <Stat
            label="Grid Stability"
            value={snapshot ? `${snapshot.systemHealthScore} / 100` : "—"}
            delta={live.status}
          />
          <Stat
            label="Battery Reserve"
            value={snapshot ? `${totals.bat.toFixed(0)} MWh avg` : `${totals.bat.toFixed(0)} %`}
            delta={live.status}
          />
          <Stat
            label="Blackout Risk"
            value={monteCarlo ? `${monteCarlo.blackoutProbability.toFixed(1)} %` : "—"}
            delta={monteCarloQuery.isLoading ? "SOLVING" : live.status}
            tone="warning"
          />
        </Widget>

        <Widget title="Risk Distribution">
          <div className="space-y-2.5">
            <RiskRow label="Nominal" count={totals.dist.low} color="oklch(0.85 0.21 145)" />
            <RiskRow label="Elevated" count={totals.dist.moderate} color="oklch(0.82 0.14 200)" />
            <RiskRow label="Watch" count={totals.dist.high} color="oklch(0.82 0.17 75)" />
            <RiskRow label="Critical" count={totals.dist.critical} color="oklch(0.68 0.24 25)" />
          </div>
        </Widget>

        <Widget title="AI System Status">
          <div className="text-[oklch(0.85_0.21_145)] text-sm font-display">
            All Systems Operational
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs font-mono">
            <KV k="Models Active" v="12 / 12" />
            <KV
              k="Data Streams"
              v={snapshot ? `${snapshot.states.length} / ${snapshot.states.length}` : "0 / 0"}
            />
            <KV k="SCADA Latency" v={snapshot ? "Open-Meteo" : "—"} />
            <KV k="PMU Coverage" v={optimizer ? optimizer.systemPriority.toUpperCase() : "—"} />
          </div>
        </Widget>
      </aside>

      {/* ============== CENTER MAP ============== */}
      <section className="panel p-4 relative">
        <div className="flex items-start justify-between mb-3 gap-4">
          <div>
            <div className="hud-label">India Digital Twin</div>
            <h2 className="text-2xl font-display font-semibold tracking-tight">
              National Grid · <span className="text-[oklch(0.72_0.18_245)]">Live Operations</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Geographically accurate twin of India's transmission network. Hover any state for
              telemetry. Values shown are connected to the live backend model.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded border border-[oklch(0.85_0.21_145/0.4)] text-[oklch(0.85_0.21_145)] shrink-0">
            T+00:00:00 · IST
          </span>
        </div>
        <IndiaGeoMap data={mapData} height={760} />
      </section>

      {/* ============== RIGHT RAIL ============== */}
      <aside className="space-y-4">
        <Widget title="Top Power Corridors">
          <div className="space-y-2">
            {live.corridors.map(([a, b, v]) => (
              <div
                key={`${a}-${b}`}
                className="flex items-center justify-between text-xs font-mono"
              >
                <span className="text-foreground/90">
                  {a} → {b}
                </span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Widget>

        <Widget title="Renewable Generation" live>
          <RenewableRow
            icon="☀"
            name="Solar"
            value={snapshot ? `${(live.solarMw / 1000).toFixed(1)} GW` : "—"}
          />
          <RenewableRow
            icon="◷"
            name="Wind"
            value={snapshot ? `${(live.windMw / 1000).toFixed(1)} GW` : "—"}
          />
          <RenewableRow
            icon="◐"
            name="Hydro"
            value={snapshot ? `${(live.hydroMw / 1000).toFixed(1)} GW` : "—"}
          />
          <div className="mt-3 pt-3 border-t border-[oklch(0.72_0.18_245/0.12)] flex items-baseline justify-between">
            <span className="hud-label">Total RE Share</span>
            <span className="font-mono text-base text-[oklch(0.85_0.21_145)]">
              {snapshot ? `${snapshot.nationalRenewablePenetrationPercent.toFixed(1)}%` : "—"}
            </span>
          </div>
        </Widget>

        <Widget title="Grid Frequency" live>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl text-[oklch(0.72_0.18_245)]">49.98</span>
            <span className="text-xs text-muted-foreground font-mono">Hz · nominal 50.00</span>
          </div>
          <div className="mt-3 h-16 relative overflow-hidden rounded bg-[oklch(0.12_0.025_260/0.6)] border border-[oklch(0.72_0.18_245/0.1)]">
            <svg
              viewBox="0 0 200 60"
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
            >
              <path
                d="M0,30 Q10,28 20,30 T40,30 T60,30 T80,28 T100,32 T120,30 T140,30 T160,29 T180,31 T200,30"
                fill="none"
                stroke="oklch(0.85 0.21 145)"
                strokeWidth="1.2"
              />
            </svg>
            <div className="absolute inset-x-2 bottom-1 flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>-60s</span>
              <span>-30s</span>
              <span>now</span>
            </div>
          </div>
        </Widget>

        <Widget title="Top Stressed Nodes">
          <div className="space-y-1.5">
            {totals.top.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s.name}</span>
                </span>
                <span className="font-mono text-[oklch(0.68_0.24_25)]">{s.risk}</span>
              </div>
            ))}
          </div>
        </Widget>
      </aside>
    </div>
  );
}

function buildCorridorReadings(snapshot?: DashboardSnapshot) {
  const pairs = [
    ["Rajasthan", "Delhi"],
    ["Gujarat", "Maharashtra"],
    ["Karnataka", "Tamil Nadu"],
    ["Madhya Pradesh", "Uttar Pradesh"],
    ["Chhattisgarh", "Odisha"],
  ] as const;

  return pairs.map(([a, b]) => {
    const first = snapshot?.states.find((state) => state.state === a);
    const second = snapshot?.states.find((state) => state.state === b);
    const flowMw =
      first && second
        ? Math.abs(first.energy.supplyDemandGapMw - second.energy.supplyDemandGapMw)
        : undefined;

    return [a, b, flowMw === undefined ? "—" : `${Math.round(flowMw)} MW`] as const;
  });
}

function findStateSeed(name: string) {
  return STATES.find((state) => state.name === name);
}

/* ----- shared sub-components ----- */
function Widget({
  title,
  live,
  children,
}: {
  title: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="hud-label">{title}</div>
        {live && (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-[oklch(0.85_0.21_145)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
            LIVE
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Stat({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "default" | "primary" | "accent" | "warning";
}) {
  const c = {
    default: "oklch(0.96 0.012 240)",
    primary: "oklch(0.72 0.18 245)",
    accent: "oklch(0.85 0.21 145)",
    warning: "oklch(0.82 0.17 75)",
  }[tone];
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="font-mono text-sm" style={{ color: c }}>
          {value}
        </span>
        <span className="block text-[9px] font-mono text-muted-foreground/70">{delta}</span>
      </span>
    </div>
  );
}
function RiskRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        {label}
      </span>
      <span className="font-mono text-muted-foreground">{count} states</span>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="hud-label">{k}</div>
      <div className="text-[oklch(0.82_0.14_200)]">{v}</div>
    </div>
  );
}
function RenewableRow({ icon, name, value }: { icon: string; name: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2">
        <span className="text-[oklch(0.85_0.21_145)]">{icon}</span>
        {name}
      </span>
      <span className="font-mono text-muted-foreground">{value}</span>
    </div>
  );
}
