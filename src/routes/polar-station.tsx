import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { BatteryCharging, CloudSnow, Fuel, ShieldCheck, Wind } from "lucide-react";
import {
  getPolarStationState,
  optimizePolarDispatch,
  runPolarRiskSimulation,
  type PolarScenario,
} from "@/services/polar-station";

export const Route = createFileRoute("/polar-station")({
  head: () => ({
    meta: [
      { title: "Polar Station Digital Twin · Grid Sentinel AI" },
      {
        name: "description",
        content: "Weather-aware digital twin for AI-driven energy management at polar research stations.",
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

function PolarStation() {
  const [scenario, setScenario] = useState<PolarScenario>("nominal");
  const selected = SCENARIOS.find((item) => item.id === scenario)!;
  const state = getPolarStationState(scenario);
  const risk = useMemo(() => runPolarRiskSimulation(state), [state]);
  const optimized = useMemo(() => optimizePolarDispatch(state), [state]);

  return (
    <div className="px-6 py-6 space-y-6">
      <section className="panel p-6">
        <div className="hud-label mb-2">POLAR RESEARCH STATION · DIGITAL TWIN · SIH26061</div>
        <h1 className="text-3xl font-display font-semibold">
          Weather-aware <span className="text-[oklch(0.72_0.18_245)]">energy intelligence</span>.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          A separate polar-station digital twin added alongside the original India National Grid Digital Twin. It models weather stress, load, renewable availability, battery reserve, backup generation and probabilistic energy-security risk.
        </p>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SCENARIOS.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setScenario(item.id)}
            className={`panel p-4 text-left ${scenario === item.id ? "border-[oklch(0.72_0.18_245/0.6)]" : ""}`}
          >
            <div className="hud-label">SCENARIO {String(index + 1).padStart(2, "0")}</div>
            <div className="font-display mt-1">{item.name}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <section className="panel p-6">
          <div className="hud-label mb-4">Station state · {selected.name}</div>
          <div className="grid md:grid-cols-2 gap-4">
            <Metric icon={<CloudSnow />} label="Station load" value={`${state.loadKw} kW`} />
            <Metric icon={<Wind />} label="Renewables" value={`${state.solarKw + state.windKw} kW`} />
            <Metric icon={<BatteryCharging />} label="Battery SOC" value={`${risk.minimumSocPercent}%`} />
            <Metric icon={<Fuel />} label="Fuel used / scenario" value={`${risk.fuelUsedLitres} L`} />
          </div>
          <div className="mt-6 grid md:grid-cols-4 gap-3">
            <Stat label="Shortage probability" value={`${risk.shortageProbabilityPercent}%`} warn={risk.shortageProbabilityPercent > 5} />
            <Stat label="Expected unserved energy" value={`${risk.expectedUnservedEnergyKwh} kWh`} />
            <Stat label="Renewable utilization" value={`${risk.renewableUtilizationPercent}%`} />
            <Stat label="Scenarios" value={risk.scenarios.toLocaleString()} />
          </div>
        </section>

        <aside className="panel p-6">
          <div className="hud-label mb-2 flex items-center gap-2">
            <ShieldCheck size={13} /> SENTINEL DISPATCH
          </div>
          <div className="font-display text-xl">{optimized.recommendedAction}</div>
          <div className="mt-5 space-y-2 text-xs font-mono">
            <Row k="Weather stress" v={`${selected.storm}%`} />
            <Row k="Low-light penalty" v={`${selected.light}%`} />
            <Row k="Wind derating" v={`${selected.wind}%`} />
            <Row k="Battery reserve target" v={`${state.reserveTargetPercent}%`} />
            <Row k="Operating mode" v="ADVISORY" />
          </div>
          <div className="mt-5 text-[10px] text-muted-foreground">
            Synthetic prototype inputs; not live polar-station telemetry. Decision support only.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border border-[oklch(0.72_0.18_245/0.12)]">
      <div className="hud-label flex items-center gap-2">{icon}{label}</div>
      <div className="font-mono text-xl mt-2">{value}</div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="p-4 rounded-lg bg-[oklch(0.16_0.028_260/0.6)]">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg mt-1 ${warn ? "text-[oklch(0.82_0.17_75)]" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[oklch(0.72_0.18_245/0.08)] pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
