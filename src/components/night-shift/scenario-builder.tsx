import { Copy, Play, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { DcNetworkView } from "@/components/grid/dc-network-view";
import {
  runSimulationPipeline,
  type OperatorIntervention,
  type ScenarioBuilderInput,
} from "@/services/grid-engine/simulation-pipeline";
import { validatePipelineResult } from "@/services/grid-validation";

const NORMAL_DAY: ScenarioBuilderInput = {
  heatwaveSeverity: 0,
  cloudCoverPct: 20,
  windSpeedKmh: 40,
  temperatureC: 31,
  humidityPct: 46,
  demandGrowthPct: 0,
  batterySocPct: 82,
  generatorTrip: false,
  transmissionFailure: false,
  importAvailabilityMW: 6500,
  lngPriceMultiplier: 1,
  industrialDemandMultiplier: 1,
  renewableForecastErrorPct: 4,
};
const PRESETS: Readonly<Record<"NORMAL DAY" | "HEATWAVE" | "BLACK SKY", ScenarioBuilderInput>> = {
  "NORMAL DAY": NORMAL_DAY,
  HEATWAVE: {
    ...NORMAL_DAY,
    heatwaveSeverity: 5,
    temperatureC: 42,
    demandGrowthPct: 12,
    industrialDemandMultiplier: 1.08,
    cloudCoverPct: 55,
    batterySocPct: 58,
    lngPriceMultiplier: 1.35,
  },
  "BLACK SKY": {
    ...NORMAL_DAY,
    heatwaveSeverity: 8,
    temperatureC: 45,
    cloudCoverPct: 88,
    windSpeedKmh: 20,
    humidityPct: 65,
    demandGrowthPct: 18,
    batterySocPct: 42,
    generatorTrip: true,
    transmissionFailure: true,
    importAvailabilityMW: 2600,
    lngPriceMultiplier: 1.65,
    industrialDemandMultiplier: 1.12,
    renewableForecastErrorPct: 22,
  },
};

type NumericKey = Exclude<keyof ScenarioBuilderInput, "generatorTrip" | "transmissionFailure">;
type ScenarioRun = {
  readonly snapshot: ReturnType<typeof runSimulationPipeline>;
  readonly recommendation: OperatorIntervention;
};

/** Additional Night Shift capability: inputs only; all outcomes come from the existing Grid Engine pipeline. */
export function ScenarioBuilder() {
  const [input, setInput] = useState<ScenarioBuilderInput>(NORMAL_DAY);
  const [result, setResult] = useState<ScenarioRun | null>(null);
  const [saved, setSaved] = useState(false);
  const validation = useMemo(
    () => (result ? validatePipelineResult(result.snapshot, result.recommendation) : null),
    [result],
  );
  const setNumber = (key: NumericKey, value: string) =>
    setInput((current) => ({ ...current, [key]: Number(value) }));
  const run = () => {
    const evaluations = (["hold", "battery", "thermal", "demand-response", "imports"] as const).map(
      (recommendation) => ({
        recommendation,
        snapshot: runSimulationPipeline({
          scenario: "base",
          intervention: recommendation,
          timeMinutes: 0,
          batterySocPct: input.batterySocPct,
          custom: input,
        }),
      }),
    );
    const recommended = evaluations.reduce((best, candidate) =>
      candidate.snapshot.dispatch.objectiveScore < best.snapshot.dispatch.objectiveScore
        ? candidate
        : best,
    );
    setResult(recommended);
    setSaved(false);
  };
  const save = () => {
    localStorage.setItem("grid-sentinel-scenario-builder", JSON.stringify(input));
    setSaved(true);
  };
  const duplicate = () => {
    const stored = localStorage.getItem("grid-sentinel-scenario-builder");
    if (stored) setInput(JSON.parse(stored) as ScenarioBuilderInput);
  };
  return (
    <details className="mt-4 border border-violet-400/35 bg-[#0b0d20] p-4">
      <summary className="cursor-pointer font-mono text-xs tracking-[.16em] text-violet-200">
        SCENARIO BUILDER // OPERATOR-DEFINED CRISIS
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => (
              <button
                key={name}
                onClick={() => {
                  setInput(PRESETS[name]);
                  setResult(null);
                }}
                className="border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-violet-300"
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["Heatwave Severity", "heatwaveSeverity", 0, 10],
                ["Cloud Cover %", "cloudCoverPct", 0, 100],
                ["Wind km/h", "windSpeedKmh", 0, 100],
                ["Temperature °C", "temperatureC", -5, 55],
                ["Humidity %", "humidityPct", 0, 100],
                ["Demand Growth %", "demandGrowthPct", -20, 60],
                ["Battery SOC %", "batterySocPct", 0, 100],
                ["Import MW", "importAvailabilityMW", 0, 15000],
                ["LNG Price ×", "lngPriceMultiplier", 0.5, 3],
                ["Industrial Multiplier", "industrialDemandMultiplier", 0.5, 2],
                ["Renewable Error %", "renewableForecastErrorPct", 0, 50],
              ] as const
            ).map(([label, key, min, max]) => (
              <label key={key} className="font-mono text-[10px] text-slate-400">
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min={min}
                  max={max}
                  step={key.includes("Multiplier") || key === "lngPriceMultiplier" ? 0.05 : 1}
                  value={input[key]}
                  onChange={(event) => setNumber(key, event.target.value)}
                  className="mt-1 block w-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-4 font-mono text-[10px] text-slate-300">
            <label>
              <input
                type="checkbox"
                checked={input.generatorTrip}
                onChange={(event) =>
                  setInput((current) => ({ ...current, generatorTrip: event.target.checked }))
                }
              />{" "}
              GENERATOR TRIP
            </label>
            <label>
              <input
                type="checkbox"
                checked={input.transmissionFailure}
                onChange={(event) =>
                  setInput((current) => ({ ...current, transmissionFailure: event.target.checked }))
                }
              />{" "}
              TRANSMISSION FAILURE
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={run}
              className="inline-flex items-center gap-2 bg-violet-300 px-3 py-2 font-mono text-[10px] font-bold text-slate-950"
            >
              <Play size={13} />
              RUN SIMULATION
            </button>
            <button
              onClick={() => {
                setInput(NORMAL_DAY);
                setResult(null);
              }}
              className="inline-flex items-center gap-1 border border-slate-700 px-3 py-2 font-mono text-[10px]"
            >
              <RotateCcw size={12} />
              RESET
            </button>
            <button
              onClick={save}
              className="inline-flex items-center gap-1 border border-slate-700 px-3 py-2 font-mono text-[10px]"
            >
              <Save size={12} />
              {saved ? "SAVED" : "SAVE"}
            </button>
            <button
              onClick={duplicate}
              className="inline-flex items-center gap-1 border border-slate-700 px-3 py-2 font-mono text-[10px]"
            >
              <Copy size={12} />
              DUPLICATE
            </button>
          </div>
        </div>
        <ScenarioSummary result={result} validation={validation} />
      </div>
    </details>
  );
}

function ScenarioSummary({
  result,
  validation,
}: {
  result: ScenarioRun | null;
  validation: ReturnType<typeof validatePipelineResult> | null;
}) {
  if (!result || !validation)
    return (
      <div className="border border-dashed border-slate-700 p-5 font-mono text-xs text-slate-500">
        PRELOAD A PRESET OR DEFINE CONDITIONS, THEN RUN THE GRID ENGINE.
      </div>
    );
  const snapshot = result.snapshot;
  const metrics = [
    ["CURRENT DEMAND", `${(snapshot.load.predictedDemandMW / 1000).toFixed(1)} GW`],
    ["GENERATION", `${(snapshot.availableGenerationMW / 1000).toFixed(1)} GW`],
    ["RESERVE", `${snapshot.reserves.reserveMarginPct.toFixed(1)}%`],
    ["FREQUENCY", `${snapshot.frequencyHz.toFixed(2)} Hz`],
    ["SSI", `${snapshot.stability.score} // ${snapshot.stability.grade}`],
    ["EXPECTED UN SERVED", `${snapshot.dispatch.expectedUnservedEnergyMWh} MWh`],
    ["CARBON", `${snapshot.carbonIntensityKgPerMWh} kg/MWh`],
    ["OPERATING COST", `$${Math.round(snapshot.dispatch.generationCostPerHour / 1000)}k/h`],
  ] as const;
  return (
    <div className="border border-slate-700 bg-slate-950/50 p-4">
      <p className="hud-label text-violet-200">SCENARIO SUMMARY // GRID ENGINE OUTPUT</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <p className="font-mono text-[9px] text-slate-500">{label}</p>
            <p className="font-mono text-xs text-slate-100">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-slate-800 pt-2">
        <p className="font-mono text-[9px] text-slate-500">
          REDUCED-ORDER DC NETWORK //{" "}
          {snapshot.contingency.failedCorridorId === "none" ? "BASE CASE" : "N-1 ANALYSIS"}
        </p>
        <DcNetworkView buses={snapshot.networkBuses} powerFlow={snapshot.contingency.powerFlow} />
      </div>
      <p className="mt-4 font-mono text-[10px] text-amber-200">
        TOP RISKS:{" "}
        {snapshot.explanation.reasons
          .slice(0, 3)
          .map((reason) => reason.code)
          .join(" · ") || "NONE"}
      </p>
      <p className="mt-2 font-mono text-[10px] text-cyan-200">
        SENTINEL RECOMMENDATION: {result.recommendation.toUpperCase()} // J{" "}
        {snapshot.dispatch.objectiveScore} // CONFIDENCE {snapshot.explanation.confidenceScorePct}%
      </p>
      <p
        className={
          validation.report.overallGrade === "PASS"
            ? "mt-2 font-mono text-[10px] text-emerald-300"
            : "mt-2 font-mono text-[10px] text-amber-300"
        }
      >
        ENGINEERING VALIDATION {validation.report.overallGrade} ·{" "}
        {validation.report.passedConstraints.length} PASSED ·{" "}
        {validation.report.brokenConstraints.length} FAILED · INTEGRITY{" "}
        {validation.report.validationScore}/100
      </p>
    </div>
  );
}
