import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, CloudSnow, Fuel, ShieldCheck, Sun, Wind, Zap } from "lucide-react";
import { AntarcticaMap } from "@/components/grid/antarctica-map";
import {
  fetchPolarSimulation,
  getPolarStationState,
  optimizePolarDispatch,
  runPolarRiskSimulation,
  type PolarBackendResult,
  type PolarScenario,
} from "@/services/polar-station";

export const Route = createFileRoute("/polar-station")({
  head: () => ({
    meta: [
      { title: "Antarctica Digital Twin · Grid Sentinel AI" },
      {
        name: "description",
        content: "Antarctic energy-management digital twin for SIH26061.",
      },
    ],
  }),
  component: PolarStation,
});

const SCENARIOS: { id: PolarScenario; name: string; storm: number; light: number; wind: number }[] = [
  { id: "nominal", name: "Nominal Weather", storm: 10, light: 15, wind: 10 },
  { id: "polar-storm", name: "Polar Storm", storm: 80, light: 45, wind: 55 },
  { id: "low-light", name: "Low-Light Event", storm: 35, light: 90, wind: 20 },
  { id: "wind-derating", name: "Wind Derating", storm: 25, light: 25, wind: 75 },
];

const FUEL_COST_INR_PER_LITRE = 95;
const CO2_KG_PER_LITRE = 2.68;

function PolarStation() {
  const [scenario, setScenario] = useState<PolarScenario>("nominal");
  const [backend, setBackend] = useState<PolarBackendResult | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const selected = SCENARIOS.find((item) => item.id === scenario)!;
  const fallbackState = useMemo(() => getPolarStationState(scenario), [scenario]);
  const fallbackRisk = useMemo(() => runPolarRiskSimulation(fallbackState), [fallbackState]);
  const fallbackOptimized = useMemo(() => optimizePolarDispatch(fallbackState), [fallbackState]);

  useEffect(() => {
    let cancelled = false;
    fetchPolarSimulation(scenario)
      .then((result) => {
        if (!cancelled) setBackend(result);
      })
      .catch(() => {
        if (!cancelled) setBackend(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const state = backend?.state ?? fallbackState;
  const risk = backend?.risk ?? fallbackRisk;
  const optimized = backend?.optimized ?? fallbackOptimized;
  const fuelSaved = Math.max(0, risk.fuelUsedLitres - optimized.fuelUsedLitres);
  const fuelSavingPct = reduction(risk.fuelUsedLitres, optimized.fuelUsedLitres);
  const costSaved = fuelSaved * FUEL_COST_INR_PER_LITRE;
  const co2Avoided = fuelSaved * CO2_KG_PER_LITRE;
  const shortageReduction = reduction(risk.shortageProbabilityPercent, optimized.shortageProbabilityPercent);
  const eueReduction = reduction(risk.expectedUnservedEnergyKwh, optimized.expectedUnservedEnergyKwh);
  const renewableKw = state.solarKw + state.windKw;
  const renewableShare = Math.min(100, (renewableKw / Math.max(1, state.loadKw)) * 100);
  const systemRisk = Math.min(100, Math.round(risk.shortageProbabilityPercent * 2.4 + (100 - risk.minimumSocPercent) * 0.18));

  return (
    <div className="px-4 lg:px-5 py-4 max-w-[1800px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_330px] gap-3">
        <aside className="space-y-3">
          <Panel title="ANTARCTICA STATION NETWORK">
            <MetricRow icon={<ShieldCheck />} label="Active Indian stations" value="2 / 2" tone="good" />
            <MetricRow icon={<Zap />} label="Representative load" value={`${state.loadKw} kW`} />
            <MetricRow icon={<Wind />} label="Renewable share" value={`${renewableShare.toFixed(1)} %`} tone="good" />
            <MetricRow icon={<BatteryCharging />} label="Battery reserve" value={`${state.batteryEnergyKwh.toFixed(0)} kWh`} />
            <MetricRow icon={<Fuel />} label="Backup generator" value={`${state.generatorKw} kW`} />
            <MetricRow icon={<ShieldCheck />} label="Shortage risk" value={`${risk.shortageProbabilityPercent.toFixed(1)} %`} tone={risk.shortageProbabilityPercent > 5 ? "warn" : "good"} />
          </Panel>

          <Panel title="SCENARIO INPUTS">
            <MetricRow icon={<CloudSnow />} label="Weather stress" value={`${selected.storm}%`} tone="warn" />
            <MetricRow icon={<Sun />} label="Low-light factor" value={`${selected.light}%`} />
            <MetricRow icon={<Wind />} label="Wind derating" value={`${selected.wind}%`} />
            <MetricRow icon={<BatteryCharging />} label="Reserve target" value={`${state.reserveTargetPercent}%`} />
          </Panel>

          <Panel title="RISK LEVELS · CONTEXT">
            <RiskDot name="Bharati" value="Active" tone="good" />
            <RiskDot name="Maitri" value="Active" tone="good" />
            <RiskDot name="Dakshin Gangotri" value="Historic" tone="warn" />
            <RiskDot name="Larsemann Hills" value="Context" tone="info" />
            <div className="text-[9px] text-muted-foreground mt-3 leading-relaxed">Station labels provide geographic context. The energy simulation is a representative polar-station twin, not separate live telemetry for each location.</div>
          </Panel>

          <Panel title="MODEL STATUS">
            <div className="text-[oklch(0.85_0.21_145)] text-sm font-display">Simulation Operational</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Mini label="Engine" value="Monte Carlo" />
              <Mini label="Scenarios" value={risk.scenarios.toLocaleString()} />
              <Mini label="Seed" value="26061" />
              <Mini label="Mode" value="Advisory" />
            </div>
          </Panel>
        </aside>

        <main className="space-y-3 min-w-0">
          <section className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="hud-label">ANTARCTICA DIGITAL TWIN</div>
                <h1 className="text-2xl lg:text-3xl font-display font-semibold">Polar Station Energy Operations</h1>
                <p className="text-xs text-muted-foreground mt-1">Scenario simulation, probabilistic risk analysis and reserve-aware dispatch for SIH26061.</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-2 rounded-lg border border-[oklch(0.85_0.21_145/0.3)] bg-[oklch(0.85_0.21_145/0.05)] text-[10px] font-mono text-[oklch(0.85_0.21_145)]">● SIMULATION ONLINE</div>
                <div className="px-3 py-2 rounded-lg border border-[oklch(0.72_0.18_245/0.2)] text-[10px] font-mono">SEED 26061</div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SCENARIOS.map((item, index) => (
              <button key={item.id} onClick={() => setScenario(item.id)} className={`panel p-3 text-left transition-all ${scenario === item.id ? "border-[oklch(0.72_0.18_245/0.75)] bg-[oklch(0.72_0.18_245/0.07)]" : "hover:border-[oklch(0.72_0.18_245/0.35)]"}`}>
                <div className="hud-label">SCENARIO {String(index + 1).padStart(2, "0")}</div>
                <div className="font-display text-sm mt-1">{item.name}</div>
              </button>
            ))}
          </div>

          <section className="panel p-3 min-h-[500px]">
            <AntarcticaMap risk={systemRisk} />
            {selectedStation && <div className="sr-only">Selected station: {selectedStation}</div>}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Panel title="RENEWABLE GENERATION · CURRENT">
              <Generation name="Solar" icon="☀" value={`${state.solarKw} kW`} pct={state.solarKw / Math.max(1, renewableKw)} />
              <Generation name="Wind" icon="♢" value={`${state.windKw} kW`} pct={state.windKw / Math.max(1, renewableKw)} />
              <Generation name="Diesel" icon="▣" value={`${risk.fuelUsedLitres} L / scenario`} pct={Math.min(1, risk.fuelUsedLitres / 10)} />
            </Panel>
            <Panel title="LOAD & BATTERY">
              <div className="grid grid-cols-2 gap-3">
                <BigMetric label="Total Load" value={`${state.loadKw} kW`} />
                <BigMetric label="Battery SOC" value={`${risk.minimumSocPercent}%`} />
              </div>
              <div className="mt-3 h-2 rounded bg-white/10 overflow-hidden"><div className="h-full bg-[oklch(0.85_0.21_145)]" style={{ width: `${Math.min(100, risk.minimumSocPercent)}%` }} /></div>
              <div className="text-[9px] text-muted-foreground mt-1">Minimum simulated SOC · reserve target {state.reserveTargetPercent}%</div>
            </Panel>
            <Panel title="SCENARIO SIMULATION">
              <div className="text-xs font-mono">{selected.name}</div>
              <div className="mt-2 text-[10px] text-muted-foreground">5,000 seeded scenarios evaluate demand, renewables, battery headroom and generator availability.</div>
              <div className="mt-3 px-3 py-2 rounded border border-[oklch(0.72_0.18_245/0.25)] text-center font-mono text-[10px]">RUNNING · {risk.scenarios.toLocaleString()} SCENARIOS</div>
            </Panel>
          </div>
        </main>

        <aside className="space-y-3">
          <Panel title="HERO IMPACT · BASELINE VS SENTINEL" accent>
            <div className="text-center text-[10px] text-muted-foreground mb-3">Same {risk.scenarios.toLocaleString()} scenarios · Seed 26061</div>
            <div className="grid grid-cols-2 gap-2">
              <Impact value={`${fuelSavingPct ?? 0}%`} label="Fuel saving" detail={`${fuelSaved.toFixed(1)} L / scenario`} />
              <Impact value={`₹${Math.round(costSaved).toLocaleString("en-IN")}`} label="Fuel cost avoided" detail="per scenario" />
              <Impact value={`${co2Avoided.toFixed(1)} kg`} label="CO₂ avoided" detail="per scenario" />
              <Impact value={`${shortageReduction ?? 0}%`} label="Shortage risk" detail="relative reduction" />
              <div className="col-span-2"><Impact value={`${eueReduction ?? 0}%`} label="EUE" detail="relative reduction" /></div>
            </div>
            <div className="mt-3 text-[9px] text-muted-foreground leading-relaxed">MODELED · NOT FIELD MEASURED. Fuel cost assumption ₹95/L; CO₂ factor 2.68 kg/L. Values are simulator outputs, not measured station savings.</div>
          </Panel>

          <Panel title="AI CONTROL ROOM">
            <div className="flex items-center justify-between mb-3"><span className="font-display">Grid Sentinel AI</span><span className="text-[9px] font-mono text-[oklch(0.82_0.17_75)]">SERVER-SIDE</span></div>
            <div className="space-y-2 text-[10px] text-muted-foreground">
              <div>✓ National grid analysis</div><div>✓ Monte Carlo results</div><div>✓ Polar station operations</div><div>✓ Optimization insights</div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-[9px] text-muted-foreground">Structured answers: Assessment → Evidence → Action → Impact → Data status.</div>
            <a href="/control-room" className="mt-3 block text-center px-3 py-2 rounded-lg bg-[oklch(0.72_0.18_245)] text-[oklch(0.1_0.02_260)] text-xs font-medium">Open AI Control Room →</a>
          </Panel>

          <Panel title="STATION STATUS">
            <Status name="Bharati" value="Active" tone="good" />
            <Status name="Maitri" value="Active" tone="good" />
            <Status name="Dakshin Gangotri" value="Historic" tone="warn" />
            <Status name="Larsemann Hills" value="Context" tone="info" />
          </Panel>

          <Panel title="SENTINEL DISPATCH">
            <div className="text-xs leading-relaxed">{optimized.recommendedAction}</div>
            <div className="mt-3 space-y-1 text-[9px] font-mono"><Row k="Minimum SOC" v={`${optimized.minimumSocPercent}%`} /><Row k="Fuel / scenario" v={`${optimized.fuelUsedLitres} L`} /><Row k="Renewable use" v={`${optimized.renewableUtilizationPercent}%`} /></div>
          </Panel>
        </aside>
      </div>
      <div className="mt-3 text-center text-[9px] text-muted-foreground font-mono">Synthetic prototype inputs · representative polar-station model · decision support only · not live Antarctic telemetry</div>
    </div>
  );
}

function reduction(baseline: number, optimized: number): number | null { if (baseline <= 0) return null; return Math.round(((baseline - optimized) / baseline) * 1000) / 10; }

function Panel({ title, children, accent = false }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return <section className={`panel p-3 ${accent ? "border-[oklch(0.85_0.21_145/0.4)] shadow-[0_0_35px_-20px_oklch(0.85_0.21_145/0.7)]" : ""}`}><div className="hud-label mb-3">{title}</div>{children}</section>;
}
function MetricRow({ icon, label, value, tone = "normal" }: { icon: React.ReactNode; label: string; value: string; tone?: "normal" | "good" | "warn" }) { const color = tone === "good" ? "text-[oklch(0.85_0.21_145)]" : tone === "warn" ? "text-[oklch(0.82_0.17_75)]" : "text-foreground"; return <div className="flex items-center gap-2 py-1.5"><span className="text-muted-foreground">{icon}</span><span className="text-[10px] text-muted-foreground flex-1">{label}</span><span className={`text-xs font-mono ${color}`}>{value}</span></div>; }
function RiskDot({ name, value, tone }: { name: string; value: string; tone: "good" | "warn" | "info" }) { const c = tone === "good" ? "bg-[oklch(0.85_0.21_145)]" : tone === "warn" ? "bg-[oklch(0.82_0.17_75)]" : "bg-[oklch(0.72_0.18_245)]"; return <div className="flex items-center gap-2 py-1 text-[10px]"><span className={`w-2 h-2 rounded-full ${c}`} /><span className="flex-1">{name}</span><span className="font-mono text-muted-foreground">{value}</span></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06]"><div className="text-[8px] text-muted-foreground">{label}</div><div className="text-[10px] font-mono mt-1">{value}</div></div>; }
function Generation({ name, icon, value, pct }: { name: string; icon: string; value: string; pct: number }) { return <div className="flex items-center gap-2 py-1.5"><span className="text-lg">{icon}</span><span className="text-[10px] flex-1">{name}</span><span className="text-xs font-mono">{value}</span><div className="w-14 h-1.5 bg-white/10 rounded overflow-hidden"><div className="h-full bg-[oklch(0.72_0.18_245)]" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} /></div></div>; }
function BigMetric({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] text-muted-foreground">{label}</div><div className="text-xl font-mono mt-1">{value}</div></div>; }
function Impact({ value, label, detail }: { value: string; label: string; detail: string }) { return <div className="rounded-lg border border-[oklch(0.85_0.21_145/0.18)] bg-[oklch(0.85_0.21_145/0.035)] p-3"><div className="text-[9px] text-muted-foreground">{label}</div><div className="text-2xl font-mono text-[oklch(0.85_0.21_145)] mt-1">{value}</div><div className="text-[8px] text-muted-foreground mt-1">{detail}</div></div>; }
function Status({ name, value, tone }: { name: string; value: string; tone: "good" | "warn" | "info" }) { const c = tone === "good" ? "text-[oklch(0.85_0.21_145)]" : tone === "warn" ? "text-[oklch(0.82_0.17_75)]" : "text-[oklch(0.72_0.18_245)]"; return <div className="flex items-center py-1.5 text-[10px]"><span className={`w-2 h-2 rounded-full mr-2 ${tone === "good" ? "bg-[oklch(0.85_0.21_145)]" : tone === "warn" ? "bg-[oklch(0.82_0.17_75)]" : "bg-[oklch(0.72_0.18_245)]"}`} /><span className="flex-1">{name}</span><span className={c}>{value}</span></div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between border-b border-white/[0.06] py-1"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>; }
