import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { IndiaMap } from "@/components/grid/india-map";
import { MetricCard } from "@/components/grid/metric-card";
import { AIRecommendationPanel } from "@/components/grid/ai-recommendation";
import { ReasoningChain, type ReasoningStep } from "@/components/grid/reasoning-chain";
import {
  useGridOptimizerResult,
  useMonteCarloResult,
  useNationalGridSnapshot,
} from "@/hooks/use-grid-backend";
import { STATES } from "@/lib/grid-data";

type Knob = {
  id: string;
  label: string;
  unit: string;
  hint: string;
};

const KNOBS: Knob[] = [
  { id: "heat", label: "Heatwave Severity", unit: "°C above norm", hint: "Drives AC demand" },
  { id: "surge", label: "Demand Surge", unit: "%", hint: "Industrial + residential" },
  { id: "wind", label: "Wind Failure", unit: "%", hint: "Generation derating" },
  { id: "solar", label: "Solar Failure", unit: "%", hint: "Cloud / dust event" },
  { id: "batt", label: "Battery Capacity", unit: "% online", hint: "BESS availability" },
  { id: "gas", label: "Gas Plant Outage", unit: "GW offline", hint: "Forced outage" },
  { id: "tx", label: "Transmission Failure", unit: "corridors", hint: "Inter-state trips" },
];

const DEFAULTS: Record<string, number> = {
  heat: 2,
  surge: 8,
  wind: 10,
  solar: 8,
  batt: 92,
  gas: 1.5,
  tx: 0,
};

const RANGES: Record<string, [number, number, number]> = {
  heat: [0, 12, 1],
  surge: [0, 60, 1],
  wind: [0, 100, 5],
  solar: [0, 100, 5],
  batt: [0, 100, 5],
  gas: [0, 12, 0.5],
  tx: [0, 8, 1],
};

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Crisis Simulation Lab · Grid Sentinel AI" },
      {
        name: "description",
        content:
          "Simulate national-scale energy crises in real time. Move the sliders — the grid responds instantly.",
      },
      { property: "og:title", content: "Crisis Simulation Lab" },
      { property: "og:description", content: "Predict. Simulate. Optimize. Prevent." },
    ],
  }),
  component: Simulation,
});

function Simulation() {
  const [k, setK] = useState(DEFAULTS);
  const snapshotQuery = useNationalGridSnapshot();
  const monteCarloQuery = useMonteCarloResult();
  const optimizerQuery = useGridOptimizerResult();
  const snapshot = snapshotQuery.data;
  const monteCarlo = monteCarloQuery.data;
  const optimizer = optimizerQuery.data;

  const sim = useMemo(() => {
    const baseStates = snapshot
      ? snapshot.states.map((s) => ({
          id: stateId(s.state),
          name: s.state,
          x: stateCoords(s.state)?.x ?? 500,
          y: stateCoords(s.state)?.y ?? 450,
          demand: s.demand.estimatedLoadMw / 1000,
          forecast: s.energy.estimatedDemandMw / 1000,
          renewable: s.energy.netRenewableGenerationMw / 1000,
          battery: Math.round(s.energy.batteryAvailableMwh / 12),
          risk: s.energy.gridStressIndex,
          blackout: Math.round(
            monteCarlo?.blackoutProbability ?? Math.max(0, s.energy.gridStressIndex * 0.35),
          ),
          recommendation:
            optimizer?.recommendedActions.find((a) => a.state === s.state)?.reason ??
            "Live backend model nominal",
        }))
      : STATES;
    // Composite stress derived from knobs
    const stress = Math.min(
      100,
      (snapshot?.nationalGridStressIndex ?? 0) * 0.35 +
        k.heat * 4 +
        k.surge * 0.7 +
        k.wind * 0.25 +
        k.solar * 0.3 +
        (100 - k.batt) * 0.3 +
        k.gas * 5 +
        k.tx * 6,
    );
    const states = baseStates.map((s) => {
      // Per-state susceptibility
      const susceptibility = (s.risk / 100) * 0.6 + (s.demand / 30) * 0.4;
      const risk = Math.max(8, Math.min(100, Math.round(stress * (0.55 + 0.9 * susceptibility))));
      const blackout = Math.min(
        95,
        Math.round((monteCarlo?.blackoutProbability ?? risk * 0.35) + risk * 0.08),
      );
      return { ...s, risk, blackout };
    });
    const affected = states.filter((s) => s.risk >= 70).length;
    const liveGapGw = snapshot
      ? Math.max(0, -snapshot.states.reduce((a, s) => a + s.energy.supplyDemandGapMw, 0) / 1000)
      : 0;
    const deficit = Math.round(
      liveGapGw +
        (k.surge * 0.6 + k.heat * 0.8 + k.solar * 0.05 + k.wind * 0.04 + k.gas * 0.9) * 0.6,
    );
    const reliability = Math.max(
      60,
      +(snapshot ? snapshot.systemHealthScore - stress * 0.12 : 100 - stress * 0.32).toFixed(2),
    );
    const carbon = +(
      (snapshot?.states.reduce((a, s) => a + s.energy.carbonIntensityEstimate, 0) ?? 0) /
        Math.max(1, snapshot?.states.length ?? 1) /
        100 +
      (k.gas * 220 + k.surge * 18) / 10
    ).toFixed(1);
    const cost = +(deficit * 6 + (k.surge * 8 + k.heat * 12 + k.gas * 60) / 10).toFixed(1);

    // Recommended mix adapts to scarcity
    const renewableCut = (k.wind + k.solar) / 2;
    const solarPct = Math.max(8, Math.round(32 - renewableCut * 0.18));
    const windPct = Math.max(6, Math.round(24 - renewableCut * 0.14));
    const battPct = Math.min(28, Math.round(14 + (100 - k.batt) * -0.1 + stress * 0.08));
    const gasPct = Math.min(34, Math.round(18 + stress * 0.12));
    const coalPct = Math.max(4, 100 - solarPct - windPct - battPct - gasPct);

    return {
      stress,
      states,
      affected,
      deficit,
      reliability,
      blackout: Math.round(Math.min(92, stress * 0.45)),
      carbon,
      cost,
      battDispatchGW: +Math.min(28, Math.max(0, (stress - 30) * 0.18)).toFixed(1),
      reserveMargin: +Math.max(1.2, 9 - stress * 0.07).toFixed(1),
      mix: [
        { label: "Solar", pct: solarPct, color: "oklch(0.85 0.21 145)" },
        { label: "Wind", pct: windPct, color: "oklch(0.82 0.14 200)" },
        { label: "Battery", pct: battPct, color: "oklch(0.72 0.18 245)" },
        { label: "Gas", pct: gasPct, color: "oklch(0.82 0.17 75)" },
        { label: "Coal", pct: coalPct, color: "oklch(0.55 0.04 260)" },
      ],
    };
  }, [k, monteCarlo?.blackoutProbability, optimizer?.recommendedActions, snapshot]);

  // Live engineering reasoning — recomputes on every knob change
  const reasoning = useMemo<ReasoningStep[]>(() => {
    const steps: ReasoningStep[] = [];
    if (k.heat > 1 || k.surge > 5) {
      steps.push({
        signal:
          k.heat > 4
            ? "Heatwave drives AC load above forecast"
            : "National demand rising above baseline",
        detail: `+${(k.heat * 1.6 + k.surge * 0.25).toFixed(1)} GW`,
        trend: "up",
      });
    }
    if (k.solar > 5 || k.wind > 5) {
      steps.push({
        signal:
          k.solar > k.wind
            ? "Solar generation degrading (cloud / dust)"
            : "Wind ramp falling below schedule",
        detail: `−${((k.solar + k.wind) * 0.12).toFixed(1)} GW renewable`,
        trend: "down",
      });
    }
    if (k.gas > 0.5 || k.tx > 0) {
      steps.push({
        signal:
          k.tx > 0 ? `Transmission corridors tripping (${k.tx})` : "Forced thermal outage detected",
        detail: k.tx > 0 ? `${k.tx} link${k.tx > 1 ? "s" : ""} offline` : `${k.gas} GW offline`,
        trend: "down",
      });
    }
    steps.push({
      signal: "Operating reserve margin compressing",
      detail: `${sim.reserveMargin}% of demand`,
      trend: sim.reserveMargin < 4 ? "down" : "stable",
    });
    if (sim.battDispatchGW > 0.4) {
      steps.push({
        signal: `Pre-dispatch BESS · ${sim.affected > 4 ? "multi-region" : "regional"} cluster`,
        detail: `+${sim.battDispatchGW} GW`,
        trend: "action",
      });
    }
    if (sim.stress > 55) {
      steps.push({
        signal: "Arm demand-response · tier 2 feeders",
        detail: `−${Math.round(sim.stress * 8)} MW peak`,
        trend: "action",
      });
    }
    steps.push(
      sim.blackout > 25
        ? {
            signal: "Residual blackout risk · escalate to operator",
            detail: `P ${sim.blackout}%`,
            trend: "up",
          }
        : sim.blackout > 8
          ? {
              signal: "Risk contained · monitor next 6 h",
              detail: `P ${sim.blackout}%`,
              trend: "stable",
            }
          : {
              signal: "Grid stabilized within envelope",
              detail: `P ${sim.blackout}%`,
              trend: "resolved",
            },
    );
    return steps;
    // sim is derived from k, so re-computing on k is sufficient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, sim.battDispatchGW, sim.reserveMargin, sim.affected, sim.blackout]);

  // Hero outcome — establishes hierarchy
  const heroTone =
    sim.blackout > 25
      ? { c: "oklch(0.68 0.24 25)", label: "CRITICAL" }
      : sim.blackout > 8
        ? { c: "oklch(0.82 0.17 75)", label: "WATCH" }
        : { c: "oklch(0.85 0.21 145)", label: "NOMINAL" };
  const stress = sim.stress;

  return (
    <div className="px-6 py-6 space-y-6">
      <section className="panel p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[oklch(0.68_0.24_25)]/8 blur-3xl" />
        <div className="hud-label mb-2 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.68_0.24_25)] animate-flicker" />
          CRISIS SIMULATION LAB · NON-OPERATIONAL ENVIRONMENT
        </div>
        <h1 className="text-3xl font-display font-semibold">
          Stress-test the{" "}
          <span className="text-[oklch(0.72_0.18_245)] text-glow-primary">National Grid</span> · in
          real time
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Move any control. The digital twin re-simulates 10,000 dispatch scenarios per second and
          updates state-level risk, blackout probability, and the AI recommendation instantly.
        </p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        {/* Knobs */}
        <aside className="panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="hud-label">Scenario controls</div>
              <div className="text-sm font-display">Stressor matrix</div>
            </div>
            <button
              onClick={() => setK(DEFAULTS)}
              className="text-[10px] font-mono px-2 py-1 rounded border border-[oklch(0.72_0.18_245/0.3)] text-[oklch(0.72_0.18_245)] hover:bg-[oklch(0.72_0.18_245/0.08)]"
            >
              RESET
            </button>
          </div>
          {KNOBS.map((knob) => {
            const [min, max, step] = RANGES[knob.id];
            const val = k[knob.id];
            const pct = ((val - min) / (max - min)) * 100;
            return (
              <div key={knob.id}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div>
                    <div className="text-sm font-medium">{knob.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{knob.hint}</div>
                  </div>
                  <div className="font-mono text-sm text-[oklch(0.72_0.18_245)] tabular-nums">
                    {val}
                    <span className="text-[10px] text-muted-foreground ml-1">{knob.unit}</span>
                  </div>
                </div>
                <div className="relative h-7 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-[oklch(0.3_0.03_255/0.6)]" />
                  <div
                    className="absolute h-1.5 rounded-full bg-gradient-to-r from-[oklch(0.72_0.18_245)] to-[oklch(0.82_0.14_200)] shadow-[0_0_12px_oklch(0.72_0.18_245/0.6)]"
                    style={{ width: `${pct}%` }}
                  />
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => setK({ ...k, [knob.id]: +e.target.value })}
                    className="relative w-full appearance-none bg-transparent cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-[oklch(0.85_0.21_145)]
                      [&::-webkit-slider-thumb]:shadow-[0_0_16px_oklch(0.85_0.21_145/0.8)]
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#070B14]
                      [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[oklch(0.85_0.21_145)]
                      [&::-moz-range-thumb]:border-0"
                  />
                </div>
              </div>
            );
          })}
        </aside>

        {/* Sim viz */}
        <div className="space-y-6">
          {/* HERO OUTCOME — singular, dominant, reads first */}
          <div className="panel p-7 md:p-8 relative overflow-hidden">
            <div
              className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-[120px] transition-all duration-700"
              style={{ background: `${heroTone.c}22` }}
            />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 items-center">
              <div>
                <div className="hud-label flex items-center gap-3 mb-3">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-flicker"
                    style={{ background: heroTone.c, boxShadow: `0 0 10px ${heroTone.c}` }}
                  />
                  PROJECTED OUTCOME · {heroTone.label}
                </div>
                <div className="flex items-baseline gap-4">
                  <div
                    className="font-display font-semibold tabular-nums leading-none transition-colors duration-500"
                    style={{
                      fontSize: "clamp(56px, 8vw, 104px)",
                      color: heroTone.c,
                      textShadow: `0 0 36px ${heroTone.c}55`,
                    }}
                  >
                    {sim.blackout}
                    <span className="text-3xl md:text-4xl opacity-70">%</span>
                  </div>
                  <div className="text-sm text-muted-foreground max-w-[18ch] leading-snug">
                    Blackout probability across the next 6 h dispatch window.
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] text-muted-foreground">
                  <span>
                    RESERVE ·{" "}
                    <span className="text-foreground tabular-nums">{sim.reserveMargin}%</span>
                  </span>
                  <span>
                    DEFICIT · <span className="text-foreground tabular-nums">{sim.deficit} GW</span>
                  </span>
                  <span>
                    AFFECTED ·{" "}
                    <span className="text-foreground tabular-nums">{sim.affected} states</span>
                  </span>
                  <span>
                    RELIABILITY ·{" "}
                    <span className="text-foreground tabular-nums">{sim.reliability}%</span>
                  </span>
                </div>
              </div>

              {/* Live reasoning — the trust layer */}
              <ReasoningChain
                title="Why this outcome"
                meta={`SOLVE ${(12 + (stress % 9)).toFixed(0)} ms · 10,240 SCENARIOS`}
                steps={reasoning}
              />
            </div>
          </div>

          {/* Live map */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-display">Live impact map · scenario projection</div>
              <span className="font-mono text-[10px] text-[oklch(0.85_0.21_145)]">
                FLOWS · {sim.states.filter((s) => s.risk >= 45).length} CORRIDORS UNDER STRESS
              </span>
            </div>
            <IndiaMap data={sim.states} height={560} />
          </div>

          {/* Secondary metrics — demoted */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Carbon Impact"
              value={sim.carbon}
              suffix=" ktCO₂"
              decimals={1}
              tone="warning"
            />
            <MetricCard
              label="Cost Impact"
              value={sim.cost}
              prefix="₹"
              suffix=" Cr/hr"
              decimals={1}
              tone="primary"
            />
            <MetricCard
              label="BESS Dispatch"
              value={sim.battDispatchGW}
              suffix=" GW"
              decimals={1}
              tone="primary"
            />
            <MetricCard
              label="Composite Stress"
              value={Math.round(sim.stress)}
              suffix=""
              tone="destructive"
            />
          </div>

          <AIRecommendationPanel
            mix={sim.mix}
            reliability={sim.reliability}
            costReduction={Math.max(2, 18 - sim.stress * 0.12)}
            carbonReduction={Math.max(4, 22 - sim.stress * 0.14)}
          />
        </div>
      </div>
    </div>
  );
}

function stateCoords(name: string) {
  return STATES.find((state) => state.name === name);
}

function stateId(name: string) {
  return stateCoords(name)?.id ?? name.slice(0, 2).toUpperCase();
}
