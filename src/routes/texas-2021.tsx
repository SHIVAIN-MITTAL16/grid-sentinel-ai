import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Snowflake, AlertTriangle, Zap, Activity, Brain, Lightbulb } from "lucide-react";
import { getTexasReplayInput } from "@/services/texas-replay-data";
import {
  runTexas2021Replay,
  type ReplayResult,
  type ReplayTimelinePoint,
} from "@/services/texas-replay";

export const Route = createFileRoute("/texas-2021")({
  head: () => ({
    meta: [
      { title: "Texas Winter Storm Uri 2021 - Grid Sentinel AI" },
      {
        name: "description",
        content:
          "An interactive replay of the February 2021 Texas grid collapse - demand vs supply, generation, blackout progression, and prescriptive actions.",
      },
      { property: "og:title", content: "Texas Winter Storm Uri - Replay" },
      {
        property: "og:description",
        content: "Inside the 2021 ERCOT collapse - modeled, animated, and explained.",
      },
    ],
  }),
  component: TexasReplay,
});

type Phase = {
  t: string;
  day: string;
  title: string;
  detail: string;
  demandGW: number | null;
  supplyGW: number | null;
  renewableGW: number | null;
  outageGW: number | null;
  freqHz: number | null;
  reserveMargin: number | null;
  blackoutProbability: number | null;
  systemStressIndex: number | null;
  recommendation?: string;
  state: PhaseState;
};

const EMPTY_PHASE: Phase = {
  t: "--",
  day: "--",
  title: "Loading replay",
  detail: "Loading Texas Winter Storm Uri replay data.",
  demandGW: null,
  supplyGW: null,
  renewableGW: null,
  outageGW: null,
  freqHz: null,
  reserveMargin: null,
  blackoutProbability: null,
  systemStressIndex: null,
  recommendation: "Replay data loading.",
  state: "info",
};

function TexasReplay() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    runTexas2021Replay(getTexasReplayInput()).then((result) => {
      if (active) setReplayResult(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const timeline = useMemo(() => replayResult?.timeline.map(toPhase) ?? [], [replayResult]);

  useEffect(() => {
    if (!playing || timeline.length === 0) return;
    ref.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= timeline.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 2200);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [playing, timeline.length]);

  const phase = timeline[idx] ?? EMPTY_PHASE;
  const tone = stateTone(phase.state);
  const summary = replayResult?.summary;
  const peakOutageGw = Math.max(1, (summary?.peakLoadShedMw ?? 1) / 1000);

  return (
    <div className="px-6 py-8 max-w-[1500px] mx-auto space-y-10">
      <header className="relative panel p-8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 100% 0%, oklch(0.72 0.18 245 / 0.35), transparent 70%)",
          }}
        />
        <Snowflake
          className="absolute top-6 right-6 text-[oklch(0.82_0.14_200)]/40"
          size={120}
          strokeWidth={0.6}
        />
        <div className="relative">
          <div className="hud-label">Case Study - February 2021</div>
          <h1 className="display-lg mt-2 font-display">
            Texas Winter Storm <span className="text-[oklch(0.82_0.14_200)]">Uri</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mt-4">
            A replay driven by loaded Texas benchmark demand, generation, weather, and alert
            records. Missing outage, frequency, or load-shed observations remain unavailable rather
            than being estimated.
          </p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            <HeroStat
              label="Peak unserved load"
              value={`${mwToGw(summary?.peakLoadShedMw)} GW`}
              tone="critical"
            />
            <HeroStat
              label="Peak demand"
              value={`${mwToGw(summary?.peakDemandMw)} GW`}
              tone="warning"
            />
            <HeroStat
              label="Peak forced outage"
              value={`${mwToGw(summary?.peakForcedOutageMw)} GW`}
              tone="critical"
            />
            <HeroStat
              label="Min reserve margin"
              value={`${formatNumber(summary?.minimumReserveMarginPercent)} %`}
              tone="warning"
            />
          </div>
        </div>
      </header>

      <section className="panel p-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <div className="hud-label">Interactive replay</div>
            <h2 className="display-md font-display">Timeline - ERCOT reserve collapse</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="px-3 py-1.5 rounded border border-[oklch(0.72_0.18_245/0.35)] text-xs font-mono hover:bg-[oklch(0.72_0.18_245/0.1)] transition"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                setIdx(0);
                setPlaying(false);
              }}
              className="px-3 py-1.5 rounded border border-[oklch(0.72_0.18_245/0.2)] text-xs font-mono text-muted-foreground hover:text-foreground transition"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-[oklch(0.72_0.18_245/0.18)]" />
          <div
            className="absolute left-0 top-1/2 h-px transition-all duration-700"
            style={{
              width: `${timeline.length > 1 ? (idx / (timeline.length - 1)) * 100 : 0}%`,
              background: tone,
              boxShadow: `0 0 12px ${tone}`,
            }}
          />
          <div className="relative flex justify-between">
            {timeline.map((p, i) => {
              const active = i === idx;
              const past = i < idx;
              const dotTone = timelineSeverityTone(p);
              return (
                <button
                  key={p.t}
                  onClick={() => {
                    setIdx(i);
                    setPlaying(false);
                  }}
                  className="group flex flex-col items-center"
                >
                  <span
                    className="block w-3.5 h-3.5 rounded-full border-2 transition"
                    style={{
                      background: past || active ? dotTone : "#070B14",
                      borderColor: past || active ? dotTone : "oklch(0.72 0.18 245 / 0.35)",
                      boxShadow: active ? `0 0 16px ${dotTone}` : "none",
                    }}
                  />
                  <span
                    className={`mt-2 text-[10px] font-mono ${active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {p.day}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-muted-foreground">{phase.t}</span>
              <span
                className="px-2 py-0.5 text-[10px] font-mono rounded"
                style={{ background: tone + "22", color: tone, border: `1px solid ${tone}` }}
              >
                {phase.state.toUpperCase()}
              </span>
            </div>
            <h3 className="display-md font-display mb-2">{phase.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">{phase.detail}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Readout
                label="Demand"
                value={`${formatNullableGw(phase.demandGW)} GW`}
                tone="primary"
              />
              <Readout
                label="Generation"
                value={`${formatNullableGw(phase.supplyGW)} GW`}
                tone="accent"
              />
              <Readout
                label="Unserved load"
                value={`${formatNullableGw(phase.outageGW)} GW`}
                tone={(phase.outageGW ?? 0) > 10 ? "critical" : "warning"}
              />
              <Readout
                label="Frequency"
                value={phase.freqHz === null ? "-- Hz" : `${phase.freqHz.toFixed(2)} Hz`}
                tone={(phase.freqHz ?? 60) < 59.5 ? "critical" : "default"}
              />
            </div>
          </div>

          <DemandSupplyChart phase={phase} />
        </div>
      </section>

      <section className="panel p-6">
        <div className="hud-label">Generation and outage trajectory</div>
        <h2 className="display-md font-display mb-5">
          Demand, generation, and forced outage progression
        </h2>
        <div className="space-y-4">
          {sampleTimeline(replayResult?.timeline ?? []).map((point) => (
            <FuelBar
              key={point.timestamp}
              name={formatShortTime(point.timestamp)}
              lost={nullableGw(point.forcedOutageMw)}
              total={nullableGw(point.demandMw)}
              color={(point.loadShedMw ?? 0) > 0 ? "oklch(0.68 0.24 25)" : "oklch(0.82 0.17 75)"}
            />
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <div className="hud-label">Blackout progression</div>
        <h2 className="display-md font-display mb-5">Load shed across the ERCOT replay window</h2>
        <BlackoutGrid outageFraction={Math.min(1, (phase.outageGW ?? 0) / peakOutageGw)} />
      </section>

      <section className="panel p-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={16} className="text-[oklch(0.72_0.18_245)]" />
          <div className="hud-label">Recommendations</div>
        </div>
        <h2 className="display-md font-display mb-2">Replay-derived operating actions</h2>
        <p className="text-sm text-muted-foreground max-w-2xl mb-6">
          Actions below are generated from replay metrics and are shown chronologically.
        </p>

        <ol className="relative pl-6 border-l border-[oklch(0.72_0.18_245/0.25)] space-y-5">
          {sampleTimeline(replayResult?.timeline ?? []).map((point) => (
            <li key={point.timestamp} className="relative">
              <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-[oklch(0.85_0.21_145)] shadow-[0_0_12px_oklch(0.85_0.21_145)]" />
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-[oklch(0.85_0.21_145)] w-16">
                  {formatShortTime(point.timestamp)}
                </span>
                <span className="font-display text-base">
                  {
                    describeReplayEvent(
                      point,
                      timelineIndex(point, replayResult?.timeline ?? []),
                      replayResult?.timeline ?? [],
                    ).recommendation
                  }
                </span>
              </div>
              <div className="ml-[76px] mt-1 text-xs text-muted-foreground">
                Reserve {formatNumber(point.reserveMarginPercent)}% - blackout probability{" "}
                {formatNumber(point.blackoutProbability)}%
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: AlertTriangle,
            title: "Forced outages matter",
            body: `Peak forced outage in this replay reaches ${mwToGw(summary?.peakForcedOutageMw)} GW, collapsing reserve margin during high load.`,
          },
          {
            icon: Activity,
            title: "Reserve margin drives risk",
            body: `Minimum replay reserve margin is ${formatNumber(summary?.minimumReserveMarginPercent)}%, with load shed appearing when generation cannot meet demand.`,
          },
          {
            icon: Lightbulb,
            title: "Early action reduces shed",
            body: `Total expected unserved energy is ${formatNumber(summary?.totalExpectedUnservedEnergyMwh)} MWh in the replay window.`,
          },
        ].map((l) => (
          <div key={l.title} className="panel p-5">
            <l.icon size={20} className="text-[oklch(0.82_0.17_75)] mb-3" />
            <div className="font-display text-base mb-1.5">{l.title}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{l.body}</p>
          </div>
        ))}
      </section>

      <footer className="text-center text-[10px] font-mono text-muted-foreground pt-4">
        Sources: {replayResult?.metadata.sources.join(" - ") ?? "Loading replay sources"}
      </footer>
    </div>
  );
}

type PhaseState = "info" | "watch" | "warning" | "critical" | "recovery";
type TimelineSeverity = "safe" | "watch" | "elevated" | "critical";

type GeneratedReplayEvent = {
  title: string;
  recommendation: string;
  state: PhaseState;
};

function toPhase(
  point: ReplayTimelinePoint,
  index: number,
  timeline: readonly ReplayTimelinePoint[],
): Phase {
  const event = describeReplayEvent(point, index, timeline);

  return {
    t: formatShortTime(point.timestamp),
    day: `H${index}`,
    title: event.title,
    detail: event.recommendation,
    demandGW: nullableGw(point.demandMw),
    supplyGW: nullableGw(point.generationMw),
    renewableGW: nullableGw(point.renewableGenerationMw),
    outageGW: nullableGw(point.loadShedMw),
    freqHz: point.frequencyHz ?? null,
    reserveMargin: point.reserveMarginPercent,
    blackoutProbability: point.blackoutProbability,
    systemStressIndex: point.systemStressIndex,
    recommendation: event.recommendation,
    state: event.state,
  };
}

function describeReplayEvent(
  point: ReplayTimelinePoint,
  index: number,
  timeline: readonly ReplayTimelinePoint[],
): GeneratedReplayEvent {
  const previous = index > 0 ? timeline[index - 1] : undefined;
  const state = classifyReplayHour(point, previous);
  const title = eventTitle(point, previous, state);
  const recommendation = operatingRecommendation(point, previous, state);

  return { title, recommendation, state };
}

function classifyReplayHour(
  point: ReplayTimelinePoint,
  previous?: ReplayTimelinePoint,
): PhaseState {
  const blackout = point.blackoutProbability ?? 0;
  const reserve = point.reserveMarginPercent ?? 100;
  const frequency = point.frequencyHz ?? 50;
  const unservedMw = point.loadShedMw ?? 0;
  const deficitRatio = generationDeficitRatio(point);
  const previousBlackout = previous?.blackoutProbability ?? blackout;
  const previousUnserved = previous?.loadShedMw ?? unservedMw;
  const recovering =
    previous !== undefined &&
    (blackout < previousBlackout || unservedMw < previousUnserved) &&
    frequency >= 49.6;

  if (recovering && blackout < 75 && reserve > -10) return "recovery";
  if (
    blackout >= 75 ||
    reserve <= -15 ||
    frequency < 49.6 ||
    unservedMw >= 10_000 ||
    deficitRatio >= 0.12
  ) {
    return "critical";
  }
  if (blackout >= 40 || reserve < 0 || frequency < 49.85 || unservedMw > 0 || deficitRatio > 0) {
    return "warning";
  }
  if (blackout >= 15 || reserve < 10 || frequency < 49.98) return "watch";
  return "info";
}

function eventTitle(
  point: ReplayTimelinePoint,
  previous: ReplayTimelinePoint | undefined,
  state: PhaseState,
): string {
  const reserve = point.reserveMarginPercent ?? 100;
  const frequency = point.frequencyHz ?? 50;
  const unservedMw = point.loadShedMw ?? 0;
  const forcedOutageMw = point.forcedOutageMw ?? 0;
  const demandDeltaMw = delta(point.demandMw, previous?.demandMw);
  const generationDeltaMw = delta(point.generationMw, previous?.generationMw);
  const frequencyDelta = delta(point.frequencyHz, previous?.frequencyHz);

  if (state === "recovery") {
    if (generationDeltaMw > 500) return "Generation recovering after restart";
    if (demandDeltaMw < -500) return "Demand returning toward baseline";
    return "Blackout risk decreasing";
  }

  if (unservedMw >= 10_000) return "Rolling outages expanded";
  if (unservedMw > 0) return "Load shedding initiated";
  if (frequency < 49.6) return "Frequency falling below 49.60 Hz";
  if (frequency < 49.8 || frequencyDelta < -0.04) return "Frequency falling below 49.80 Hz";
  if (reserve < 0) return "Reserve margin entering warning threshold";
  if (forcedOutageMw >= 15_000) return "Natural gas generation unavailable";
  if (generationDeltaMw < -750) return "Generation availability declining";
  if (demandDeltaMw > 750) return "Demand rising under winter load";
  if (reserve < 10) return "Operating reserve tightening";
  return "Cold weather arriving";
}

function operatingRecommendation(
  point: ReplayTimelinePoint,
  previous: ReplayTimelinePoint | undefined,
  state: PhaseState,
): string {
  const reserve = point.reserveMarginPercent ?? 100;
  const frequency = point.frequencyHz ?? 50;
  const unservedMw = point.loadShedMw ?? 0;
  const shortageGw = roundOne(Math.max(0, unservedMw / 1000));
  const forcedOutageGw = roundOne(Math.max(0, (point.forcedOutageMw ?? 0) / 1000));
  const demandDeltaMw = delta(point.demandMw, previous?.demandMw);

  if (state === "critical") {
    if (unservedMw >= 10_000)
      return `Expand controlled load shedding by ${shortageGw.toFixed(1)} GW`;
    if (unservedMw > 0)
      return `Initiate controlled load shedding for ${shortageGw.toFixed(1)} GW deficit`;
    if (frequency < 49.6) return "Dispatch battery reserves immediately";
    return `Import emergency power and replace ${forcedOutageGw.toFixed(1)} GW unavailable generation`;
  }

  if (state === "warning") {
    if (frequency < 49.85) return "Continue monitoring frequency decline";
    if (reserve < 0) return `Increase gas dispatch by ${Math.max(1, shortageGw).toFixed(1)} GW`;
    if (demandDeltaMw > 0) return "Release demand response resources";
    return "Import emergency power";
  }

  if (state === "watch") {
    if (reserve < 10) return "Restore spinning reserve";
    return "Maintain operating reserve";
  }

  if (state === "recovery") {
    if (unservedMw > 0) return "Release demand response resources in stages";
    return "Maintain operating reserve while restoring normal dispatch";
  }

  return "Maintain operating reserve";
}

function timelineSeverityTone(phase: Phase) {
  const severity = timelineSeverity(phase);
  return severity === "critical"
    ? "oklch(0.68 0.24 25)"
    : severity === "elevated"
      ? "oklch(0.74 0.18 55)"
      : severity === "watch"
        ? "oklch(0.82 0.17 75)"
        : "oklch(0.85 0.21 145)";
}

function timelineSeverity(phase: Phase): TimelineSeverity {
  return phase.state === "critical"
    ? "critical"
    : phase.state === "warning"
      ? "elevated"
      : phase.state === "watch"
        ? "watch"
        : "safe";
}

function generationDeficitRatio(point: Pick<ReplayTimelinePoint, "demandMw" | "generationMw">) {
  return point.demandMw !== undefined && point.demandMw > 0 && point.generationMw !== undefined
    ? Math.max(0, point.demandMw - point.generationMw) / point.demandMw
    : 0;
}

function delta(current: number | undefined, previous: number | undefined) {
  return current !== undefined && previous !== undefined ? current - previous : 0;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
function stateTone(s: Phase["state"]) {
  return s === "critical"
    ? "oklch(0.68 0.24 25)"
    : s === "warning"
      ? "oklch(0.82 0.17 75)"
      : s === "recovery"
        ? "oklch(0.85 0.21 145)"
        : "oklch(0.82 0.14 200)";
}

function formatShortTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sampleTimeline(timeline: readonly ReplayTimelinePoint[]): readonly ReplayTimelinePoint[] {
  if (timeline.length <= 7) return timeline;
  const step = Math.max(1, Math.floor(timeline.length / 7));
  const sampled = timeline.filter((_, index) => index % step === 0).slice(0, 7);
  return sampled.includes(timeline.at(-1) as ReplayTimelinePoint)
    ? sampled
    : [...sampled.slice(0, 6), timeline[timeline.length - 1]];
}

function timelineIndex(point: ReplayTimelinePoint, timeline: readonly ReplayTimelinePoint[]) {
  return Math.max(
    0,
    timeline.findIndex((candidate) => candidate.timestamp === point.timestamp),
  );
}
function mwToGw(value: number | null | undefined): string {
  return formatNumber(value == null ? undefined : value / 1000);
}

function roundGw(value: number | undefined): number {
  if (value === undefined) return 0;
  return Number((value / 1000).toFixed(1));
}

function nullableGw(value: number | undefined): number | null {
  return value === undefined ? null : roundGw(value);
}

function formatNumber(value: number | null | undefined): string {
  return value === undefined || value === null ? "--" : value.toFixed(1);
}

function formatNullableGw(value: number | null): string {
  return value === null ? "--" : value.toFixed(1);
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "critical" | "warning";
}) {
  const c = tone === "critical" ? "oklch(0.68 0.24 25)" : "oklch(0.82 0.17 75)";
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: c + "55", background: c + "10" }}>
      <div className="hud-label">{label}</div>
      <div className="font-display text-2xl mt-0.5" style={{ color: c }}>
        {value}
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "accent" | "warning" | "critical";
}) {
  const c = {
    default: "oklch(0.96 0.012 240)",
    primary: "oklch(0.72 0.18 245)",
    accent: "oklch(0.85 0.21 145)",
    warning: "oklch(0.82 0.17 75)",
    critical: "oklch(0.68 0.24 25)",
  }[tone];
  return (
    <div className="rounded-lg p-3 bg-[oklch(0.16_0.028_260/0.6)] border border-[oklch(0.72_0.18_245/0.12)]">
      <div className="hud-label">{label}</div>
      <div className="font-mono text-lg mt-1" style={{ color: c }}>
        {value}
      </div>
    </div>
  );
}

function DemandSupplyChart({ phase }: { phase: Phase }) {
  const max = 85;
  const dPct = ((phase.demandGW ?? 0) / max) * 100;
  const sPct = ((phase.supplyGW ?? 0) / max) * 100;
  return (
    <div className="rounded-xl p-5 bg-[oklch(0.12_0.025_260/0.6)] border border-[oklch(0.72_0.18_245/0.12)]">
      <div className="hud-label mb-4">Demand vs Generation - replay</div>
      <div className="space-y-5">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Demand</span>
            <span className="font-mono text-[oklch(0.72_0.18_245)]">
              {formatNullableGw(phase.demandGW)} GW
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[oklch(0.3_0.03_255/0.5)] overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${dPct}%`,
                background: "linear-gradient(90deg, oklch(0.72 0.18 245), oklch(0.82 0.14 200))",
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Available generation</span>
            <span className="font-mono text-[oklch(0.85_0.21_145)]">
              {formatNullableGw(phase.supplyGW)} GW
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[oklch(0.3_0.03_255/0.5)] overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${sPct}%`, background: "oklch(0.85 0.21 145)" }}
            />
          </div>
        </div>
        {(phase.outageGW ?? 0) > 0 && (
          <div className="pt-4 border-t border-[oklch(0.68_0.24_25/0.3)]">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[oklch(0.68_0.24_25)]" />
              <span className="text-xs text-muted-foreground">Gap forces emergency shed of</span>
              <span className="font-mono text-base text-[oklch(0.68_0.24_25)]">
                {formatNullableGw(phase.outageGW)} GW
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FuelBar({
  name,
  lost,
  total,
  color,
}: {
  name: string;
  lost: number | null;
  total: number | null;
  color: string;
}) {
  const lostPct = total !== null && lost !== null && total > 0 ? (lost / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="font-display text-sm">{name}</span>
        <span className="font-mono text-muted-foreground">
          <span style={{ color }}>{formatNullableGw(lost)} GW forced outage</span> - demand{" "}
          {formatNullableGw(total)} GW
        </span>
      </div>
      <div className="relative h-3 rounded bg-[oklch(0.3_0.03_255/0.4)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: "100%", background: color, opacity: 0.18 }}
        />
        <div
          className="absolute inset-y-0 left-0 transition-all duration-1000"
          style={{ width: `${lostPct}%`, background: color, boxShadow: `0 0 16px ${color}` }}
        />
      </div>
    </div>
  );
}

function BlackoutGrid({ outageFraction }: { outageFraction: number }) {
  const cells = useMemo(() => {
    const arr: { lit: boolean; intensity: number }[] = [];
    for (let i = 0; i < 24 * 8; i++) {
      const r = ((i * 9301 + 49297) % 233280) / 233280;
      arr.push({ lit: true, intensity: r });
    }
    return arr;
  }, []);

  return (
    <div>
      <div
        className="grid grid-cols-24 gap-1"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {cells.map((c, i) => {
          const dark = c.intensity < outageFraction;
          return (
            <div
              key={i}
              className="aspect-square rounded-sm transition-all duration-700"
              style={{
                background: dark ? "oklch(0.12 0.02 260)" : "oklch(0.85 0.21 145)",
                opacity: dark ? 0.4 : 0.35 + c.intensity * 0.5,
                boxShadow: dark
                  ? "none"
                  : `0 0 6px oklch(0.85 0.21 145 / ${0.4 + c.intensity * 0.4})`,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-3 text-[10px] font-mono text-muted-foreground">
        <span>ERCOT replay zones - deterministic sample grid</span>
        <span>Offline - {Math.round(outageFraction * 100)}%</span>
      </div>
    </div>
  );
}
