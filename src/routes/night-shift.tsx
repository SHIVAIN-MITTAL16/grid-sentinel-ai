import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Clock3,
  Gauge,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DcNetworkView } from "@/components/grid/dc-network-view";
import { ScenarioBuilder } from "@/components/night-shift/scenario-builder";
import {
  ACTIONS,
  EVENTS,
  applyEvent,
  createInitialState,
  evaluateAction,
  resolveDecision,
} from "@/services/night-shift/scenario-engine";
import type { ActionId, Comparison, NightShiftState, Outcome } from "@/services/night-shift/types";

export const Route = createFileRoute("/night-shift")({
  head: () => ({
    meta: [
      { title: "Night Shift · Grid Sentinel AI" },
      { name: "description", content: "A deterministic grid operations mission simulation." },
    ],
  }),
  component: NightShift,
});

type Phase = "intro" | "briefing" | "mission" | "result" | "report";
const DECISION_WINDOW_SECONDS = 10;

function NightShift() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [eventIndex, setEventIndex] = useState(0);
  const [state, setState] = useState<NightShiftState>(() => createInitialState());
  const [eventBaseline, setEventBaseline] = useState<NightShiftState>(() => createInitialState());
  const [sentinelState, setSentinelState] = useState<NightShiftState>(() => createInitialState());
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [results, setResults] = useState<readonly Comparison[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(DECISION_WINDOW_SECONDS);
  const [expired, setExpired] = useState(false);
  const event = EVENTS[eventIndex];

  useEffect(() => {
    if (phase !== "mission") return;
    if (secondsLeft <= 0) return;
    const timeout = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase !== "mission" || secondsLeft !== 0) return;
    const timeout = window.setTimeout(() => {
      const nextComparison = resolveDecision(state, "hold");
      setComparison(nextComparison);
      setResults((current) => [...current, nextComparison]);
      setState(nextComparison.human.state);
      setSentinelState(nextComparison.sentinel.state);
      setExpired(true);
      setPhase("result");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [phase, secondsLeft, state]);

  const begin = () => {
    const initial = createInitialState();
    setEventBaseline(initial);
    setState(applyEvent(initial, EVENTS[0]));
    setSentinelState(initial);
    setResults([]);
    setComparison(null);
    setExpired(false);
    setSecondsLeft(DECISION_WINDOW_SECONDS);
    setPhase("briefing");
  };

  const decide = (action: ActionId) => {
    const nextComparison = resolveDecision(state, action);
    setComparison(nextComparison);
    setResults((current) => [...current, nextComparison]);
    setState(nextComparison.human.state);
    setSentinelState(nextComparison.sentinel.state);
    setPhase("result");
  };

  const advance = () => {
    if (!comparison) return;
    if (eventIndex === EVENTS.length - 1) {
      setPhase("report");
      return;
    }
    const nextEvent = EVENTS[eventIndex + 1];
    setEventBaseline(state);
    setState(applyEvent(state, nextEvent));
    setSentinelState(applyEvent(sentinelState, nextEvent));
    setEventIndex((current) => current + 1);
    setComparison(null);
    setExpired(false);
    setSecondsLeft(DECISION_WINDOW_SECONDS);
    setPhase("briefing");
  };

  const restart = () => {
    const initial = createInitialState();
    setState(initial);
    setEventBaseline(initial);
    setSentinelState(initial);
    setEventIndex(0);
    setComparison(null);
    setResults([]);
    setSecondsLeft(DECISION_WINDOW_SECONDS);
    setExpired(false);
    setPhase("intro");
  };

  if (phase === "intro") return <GameIntro onBegin={begin} />;
  if (phase === "briefing")
    return (
      <MissionBriefing
        event={event}
        before={eventBaseline}
        after={state}
        eventIndex={eventIndex}
        onDeploy={() => setPhase("mission")}
      />
    );
  if (phase === "report")
    return (
      <GameReport state={state} sentinel={sentinelState} results={results} onRestart={restart} />
    );

  return (
    <GameMission
      event={event}
      eventIndex={eventIndex}
      state={state}
      baseline={eventBaseline}
      secondsLeft={secondsLeft}
      comparison={comparison}
      expired={expired}
      onChoose={decide}
      onAdvance={advance}
    />
  );
}

function MissionIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="grid-bg relative grid min-h-[calc(100vh-104px)] place-items-center overflow-hidden px-6 py-14">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(29,170,255,.18),transparent_48%)]" />
      <div className="panel panel-glow relative w-full max-w-3xl p-8 text-center md:p-14 animate-fade-up">
        <div className="hud-label text-cyan-300">GRID SENTINEL // OPERATIONAL SIMULATION</div>
        <h1 className="display-lg mt-5 text-white">
          GRID SENTINEL
          <br />
          <span className="text-cyan-300 text-glow-primary">NIGHT SHIFT</span>
        </h1>
        <p className="mt-8 font-mono text-sm tracking-[.22em] text-slate-400">
          OPERATOR // JUDGE_01
        </p>
        <div className="my-10 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <p className="hud-label">MISSION</p>
        <p className="mt-2 text-2xl font-semibold tracking-wide text-emerald-300">
          KEEP THE GRID ONLINE.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 text-left font-mono text-xs">
          <IntroMetric label="SYSTEM STATUS" value="STABLE" tone="text-emerald-300" />
          <IntroMetric label="GRID FREQUENCY" value="50.00 Hz" tone="text-cyan-300" />
        </div>
        <button
          onClick={onBegin}
          className="mt-10 inline-flex items-center gap-3 rounded border border-cyan-300/70 bg-cyan-400/10 px-7 py-3 font-mono text-sm font-semibold tracking-[.18em] text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950"
        >
          BEGIN SHIFT <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

function IntroMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-950/50 p-4">
      <p className="hud-label">{label}</p>
      <p className={`mt-2 text-lg ${tone}`}>{value}</p>
    </div>
  );
}

function MissionHeader({ state, eventNumber }: { state: NightShiftState; eventNumber: number }) {
  return (
    <div className="panel flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 font-mono">
      <div>
        <span className="hud-label">MISSION TIMER</span>
        <p className="text-lg text-cyan-200">00:{String(state.timeMinutes).padStart(2, "0")}:00</p>
      </div>
      <div>
        <span className="hud-label">EVENT</span>
        <p className="text-sm text-white">0{eventNumber} / 03</p>
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs text-emerald-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
        DETERMINISTIC SECURITY MODEL
      </div>
    </div>
  );
}

function EventImpact({
  event,
  before,
  after,
}: {
  event: (typeof EVENTS)[number];
  before: NightShiftState;
  after: NightShiftState;
}) {
  const headline =
    event.id === "solar-drop"
      ? `${signedMW(after.solarMW - before.solarMW)} SOLAR`
      : event.id === "transmission-trip"
        ? "MAHARASHTRA ↔ GUJARAT // LINE TRIPPED"
        : "WESTERN GRID // S-TIER SECURITY COLLAPSE";
  const severe = event.severity === "S-TIER";
  return (
    <div
      className={`mt-4 relative overflow-hidden rounded border px-5 py-4 ${severe ? "border-red-500/70 bg-red-950/35 shadow-[0_0_34px_rgba(239,68,68,.18)]" : "border-amber-400/40 bg-amber-950/20"}`}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-current text-red-400 animate-pulse" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={severe ? "hud-label text-red-300" : "hud-label text-amber-300"}>
            EVENT IMPACT // {event.severity}
          </p>
          <h2
            className={
              severe
                ? "mt-1 text-2xl font-semibold text-red-100"
                : "mt-1 text-2xl font-semibold text-amber-50"
            }
          >
            {event.title}
          </h2>
          <p className="mt-1 font-mono text-sm text-slate-300">{headline}</p>
        </div>
        <div className="flex gap-5 font-mono text-xs">
          <ImpactDelta
            label="RESERVE"
            value={`${signedPct(after.reserveMarginPct - before.reserveMarginPct)}%`}
            bad={after.reserveMarginPct < before.reserveMarginPct}
          />
          <ImpactDelta
            label="RISK"
            value={`${signed(after.systemRisk - before.systemRisk)} pts`}
            bad={after.systemRisk > before.systemRisk}
          />
          <ImpactDelta
            label="FLOW"
            value={`${signed(after.lineLoading - before.lineLoading)}%`}
            bad={after.lineLoading > before.lineLoading}
          />
        </div>
      </div>
    </div>
  );
}
function ImpactDelta({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div>
      <p className="hud-label">{label}</p>
      <p className={bad ? "mt-1 text-sm text-red-300" : "mt-1 text-sm text-emerald-300"}>{value}</p>
    </div>
  );
}

function GridSecurityView({
  state,
  eventId,
}: {
  state: NightShiftState;
  eventId: (typeof EVENTS)[number]["id"];
}) {
  const level = state.lineLoading > 105 ? "critical" : state.lineLoading > 90 ? "watch" : "healthy";
  const colors = { healthy: "#34d399", watch: "#fbbf24", critical: "#fb7185" };
  const line = colors[level];
  const tripped = eventId === "transmission-trip" || eventId === "cascade";
  const cascade = eventId === "cascade";
  const corridors = [
    {
      id: "rajasthan-gujarat",
      d: "M110 58 L265 112",
      label: "RAJASTHAN → GUJARAT",
      loading: Math.max(72, state.lineLoading - 12),
      tone: eventId === "solar-drop" ? "watch" : "healthy",
    },
    {
      id: "gujarat-maharashtra",
      d: "M265 112 L470 180",
      label: "GUJARAT ↔ MAHARASHTRA",
      loading: state.lineLoading,
      tone: tripped ? "tripped" : level,
    },
    {
      id: "mumbai-mp",
      d: "M190 200 L360 160",
      label: "MUMBAI → M.P.",
      loading: tripped ? Math.min(118, state.lineLoading + 7) : Math.max(76, state.lineLoading - 8),
      tone: cascade ? "critical" : tripped ? "watch" : "healthy",
    },
    {
      id: "mp-delhi",
      d: "M360 160 L570 60",
      label: "M.P. → DELHI",
      loading: cascade ? Math.min(119, state.lineLoading + 4) : 82,
      tone: cascade ? "critical" : "healthy",
    },
    {
      id: "mumbai-maharashtra",
      d: "M190 200 L470 180",
      label: "MUMBAI → MAHARASHTRA",
      loading: cascade ? 108 : 84,
      tone: cascade ? "critical" : "healthy",
    },
  ] as const;
  const nodes = [
    [110, 58, "RAJASTHAN"],
    [265, 112, "GUJARAT"],
    [190, 200, "MUMBAI"],
    [360, 160, "M.P."],
    [470, 180, "MAHARASHTRA"],
    [570, 60, "DELHI"],
  ] as const;
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="hud-label">WESTERN INTERCONNECTION // NETWORK SECURITY VIEW</p>
          <h2 className="mt-1 text-xl text-white">Power Flow & Corridor Security</h2>
        </div>
        <div
          className={
            level === "critical"
              ? "text-red-400"
              : level === "watch"
                ? "text-amber-300"
                : "text-emerald-300"
          }
        >
          <p className="hud-label">PEAK CORRIDOR</p>
          <p className="font-mono text-3xl">{state.lineLoading}%</p>
        </div>
      </div>
      <svg
        viewBox="0 0 680 250"
        className="mt-2 h-[235px] w-full"
        role="img"
        aria-label="Western grid network security view"
      >
        {corridors.map((corridor) => {
          const tone =
            corridor.tone === "tripped"
              ? "#64748b"
              : corridor.tone === "critical"
                ? "#fb7185"
                : corridor.tone === "watch"
                  ? "#fbbf24"
                  : "#34d399";
          return (
            <g key={corridor.id}>
              <path d={corridor.d} fill="none" stroke="rgba(71,85,105,.4)" strokeWidth="8" />
              <path
                d={corridor.d}
                fill="none"
                stroke={tone}
                strokeWidth={corridor.tone === "tripped" ? 3 : 5}
                strokeDasharray={corridor.tone === "tripped" ? "8 8" : "12 8"}
                className={corridor.tone === "tripped" ? "opacity-55" : "animate-dash"}
              />
              <text x="0" y="0" fill={tone} fontSize="10" fontFamily="monospace">
                <textPath href={`#${corridor.id}`} startOffset="50%" textAnchor="middle">
                  {corridor.tone === "tripped" ? "TRIPPED" : `${corridor.loading}%`}
                </textPath>
              </text>
              <path id={corridor.id} d={corridor.d} fill="none" stroke="transparent" />
            </g>
          );
        })}
        {nodes.map(([x, y, label]) => (
          <g key={label}>
            <circle
              cx={x}
              cy={y}
              r="15"
              fill="#07101e"
              stroke={label === "GUJARAT" || label === "MAHARASHTRA" ? line : "#67e8f9"}
              strokeWidth="3"
            />
            <circle cx={x} cy={y} r="4" fill="#a7f3d0" />
            <text x={x + 20} y={y - 16} fill="#cbd5e1" fontSize="11" fontFamily="monospace">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[10px]">
        <Legend label="HEALTHY" tone="bg-emerald-400" />
        <Legend label="WATCH / REDISTRIBUTED" tone="bg-amber-400" />
        <Legend
          label={tripped ? "TRIPPED / CRITICAL" : "SECURE FLOW"}
          tone={tripped ? "bg-red-400" : "bg-cyan-400"}
        />
      </div>
    </div>
  );
}
function Legend({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <span className={`h-1.5 w-5 ${tone}`} />
      {label}
    </div>
  );
}

function Metrics({ state, baseline }: { state: NightShiftState; baseline: NightShiftState }) {
  const metrics: ReadonlyArray<[string, string, number, string, boolean]> = [
    [
      "SOLAR",
      mw(state.solarMW),
      state.solarMW - baseline.solarMW,
      "MW",
      state.solarMW < baseline.solarMW,
    ],
    [
      "SYSTEM FREQUENCY",
      `${state.frequencyHz.toFixed(2)} Hz`,
      state.frequencyHz - baseline.frequencyHz,
      "Hz",
      state.frequencyHz < baseline.frequencyHz,
    ],
    [
      "OPERATING RESERVE",
      `${state.reserveMarginPct.toFixed(1)}%`,
      state.reserveMarginPct - baseline.reserveMarginPct,
      "%",
      state.reserveMarginPct < baseline.reserveMarginPct,
    ],
    [
      "SECURITY RISK",
      `${state.systemRisk}%`,
      state.systemRisk - baseline.systemRisk,
      "pts",
      state.systemRisk > baseline.systemRisk,
    ],
    [
      "UNSERVED LOAD",
      mw(state.unservedLoadMW),
      state.unservedLoadMW - baseline.unservedLoadMW,
      "MW",
      state.unservedLoadMW > baseline.unservedLoadMW,
    ],
    [
      "AVAILABLE GENERATION",
      mw(state.availableGenerationMW),
      state.availableGenerationMW - baseline.availableGenerationMW,
      "MW",
      state.availableGenerationMW < baseline.availableGenerationMW,
    ],
    [
      "RENEWABLE SHARE",
      `${state.renewableShare.toFixed(1)}%`,
      state.renewableShare - baseline.renewableShare,
      "pts",
      state.renewableShare < baseline.renewableShare,
    ],
    [
      "CORRIDOR LOADING",
      `${state.lineLoading}%`,
      state.lineLoading - baseline.lineLoading,
      "pts",
      state.lineLoading > baseline.lineLoading,
    ],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {metrics.map(([label, value, delta, unit, bad]) => (
        <div
          key={label}
          className={`rounded border bg-slate-950/60 p-3 ${bad && delta !== 0 ? "border-red-400/40" : "border-slate-700/80"}`}
        >
          <p className="hud-label">{label}</p>
          <p className="mt-1 font-mono text-lg text-white">{value}</p>
          <p
            className={
              delta === 0
                ? "mt-1 font-mono text-[10px] text-slate-500"
                : bad
                  ? "mt-1 font-mono text-[10px] text-red-300"
                  : "mt-1 font-mono text-[10px] text-emerald-300"
            }
          >
            {delta === 0 ? "— no event delta" : `${bad ? "▼" : "▲"} ${formatDelta(delta, unit)}`}
          </p>
        </div>
      ))}
    </div>
  );
}

function EventPanel({
  event,
  state,
  secondsLeft,
  onChoose,
}: {
  event: (typeof EVENTS)[number];
  state: NightShiftState;
  secondsLeft: number;
  onChoose: (id: ActionId) => void;
}) {
  const boss = event.id === "cascade";
  const previews = useMemo(
    () => ACTIONS.map((action) => evaluateAction(state, action.id)),
    [state],
  );
  return (
    <div
      className={`panel p-5 ${boss ? "border-red-500/70 shadow-[0_0_34px_rgba(239,68,68,.16)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={boss ? "hud-label text-red-300" : "hud-label text-amber-300"}>
            CURRENT EVENT // {event.severity}
          </p>
          <h2 className={boss ? "mt-1 text-3xl text-red-200" : "mt-1 text-2xl text-white"}>
            {event.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-400">
            {event.location} · {event.cause}
          </p>
        </div>
        <div
          className={`rounded border px-3 py-2 text-right ${secondsLeft <= 3 ? "border-red-400 bg-red-950/40 text-red-200 animate-pulse" : "border-cyan-400/40 text-cyan-200"}`}
        >
          <p className="hud-label">DECISION WINDOW</p>
          <p className="font-mono text-2xl">00:{String(secondsLeft).padStart(2, "0")}</p>
        </div>
      </div>
      {boss && <ActiveFailures state={state} />}
      <div className="mt-4 border-t border-slate-700 pt-4">
        <p className="hud-label">HUMAN ACTION // SELECT INTERVENTION</p>
        <div className="mt-3 grid gap-2">
          {previews.map((outcome) => (
            <ActionCard
              key={outcome.action.id}
              outcome={outcome}
              before={state}
              onChoose={onChoose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  outcome,
  before,
  onChoose,
}: {
  outcome: Outcome;
  before: NightShiftState;
  onChoose: (id: ActionId) => void;
}) {
  const s = outcome.state;
  const reliability = s.systemRisk < before.systemRisk ? "↑↑" : "—";
  const cost = s.operatingCost - before.operatingCost;
  const carbon = s.carbonIntensity - before.carbonIntensity;
  const response =
    outcome.action.id === "bess"
      ? "FAST"
      : outcome.action.id === "thermal"
        ? "MEDIUM"
        : outcome.action.id === "demand-response"
          ? "FAST"
          : "NONE";
  return (
    <button
      onClick={() => onChoose(outcome.action.id)}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-slate-700 bg-slate-950/55 p-3 text-left transition hover:border-cyan-300/70 hover:bg-cyan-300/10"
    >
      <span>
        <span className="font-mono text-sm text-cyan-100">{outcome.action.label}</span>
        <span className="mt-1 block text-xs text-slate-400">{outcome.action.description}</span>
      </span>
      <span className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-slate-400">
        <span>
          RELIABILITY{" "}
          <b className={reliability === "—" ? "text-slate-400" : "text-emerald-300"}>
            {reliability}
          </b>
        </span>
        <span>
          COST{" "}
          <b className={cost > 0 ? "text-amber-300" : "text-emerald-300"}>
            {cost > 0 ? "₹₹" : "LOW"}
          </b>
        </span>
        <span>
          CARBON{" "}
          <b className={carbon > 2 ? "text-red-300" : "text-emerald-300"}>
            {carbon > 2 ? "HIGH" : "LOW"}
          </b>
        </span>
        <span>
          RESPONSE <b className="text-cyan-200">{response}</b>
        </span>
      </span>
    </button>
  );
}

function ActiveFailures({ state }: { state: NightShiftState }) {
  const failures = [
    "Demand surge",
    "Solar deficit",
    "Generator trip",
    `Western corridor ${state.lineLoading}%`,
    state.reserveMW < 0 ? "Reserve below threshold" : "Reserve erosion",
  ];
  return (
    <div className="mt-4 rounded border border-red-500/40 bg-red-950/25 p-3">
      <div className="flex justify-between">
        <p className="hud-label text-red-200">ACTIVE FAILURES</p>
        <p className="font-mono text-sm text-red-200">{failures.length}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-red-100">
        {failures.map((failure) => (
          <span key={failure}>● {failure}</span>
        ))}
      </div>
    </div>
  );
}

function Sentinel({ state, event }: { state: NightShiftState; event: (typeof EVENTS)[number] }) {
  const message =
    event.id === "transmission-trip"
      ? "Corridor redistribution detected. Four interventions evaluated."
      : event.id === "cascade"
        ? "Multiple security constraints active. Lowest-risk feasible response identified."
        : "Western reserve margin deteriorating. Four interventions evaluated.";
  return (
    <div className="rounded border border-cyan-400/25 bg-cyan-950/10 p-4">
      <div className="flex items-center gap-2 text-cyan-200">
        <Activity size={16} />
        <span className="font-mono text-xs tracking-[.15em]">
          S.E.N.T.I.N.E.L. // ANALYSIS COMPLETE
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-200">{message}</p>
      <p className="mt-2 font-mono text-[10px] text-slate-500">
        RISK {state.systemRisk}% · RESERVE {state.reserveMarginPct.toFixed(1)}% ·{" "}
        {state.currentEvent?.message}
      </p>
    </div>
  );
}

function ComparisonPanel({
  comparison,
  expired,
  onAdvance,
  final,
}: {
  comparison: Comparison;
  expired: boolean;
  onAdvance: () => void;
  final: boolean;
}) {
  const explanation = comparisonExplanation(comparison);
  return (
    <div className="panel p-5 animate-fade-up">
      <div className="flex justify-between gap-4">
        <div>
          <p className="hud-label text-emerald-300">DECISION RESULT // SAME EVALUATION ENGINE</p>
          <h2 className="mt-1 text-3xl text-white">
            YOU <span className="text-slate-500">vs</span> SENTINEL
          </h2>
        </div>
        {expired && (
          <div className="rounded border border-amber-400/50 bg-amber-950/30 px-3 py-2 font-mono text-[10px] text-amber-200">
            DECISION WINDOW EXPIRED
            <br />
            DEFAULT ACTION: HOLD / MONITOR
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <OutcomeCard label="YOU" outcome={comparison.human} other={comparison.sentinel} />
        <OutcomeCard label="SENTINEL" outcome={comparison.sentinel} other={comparison.human} />
      </div>
      <div className="mt-4 rounded border border-cyan-400/25 bg-cyan-950/15 p-3">
        <p className="hud-label text-cyan-200">WHY SENTINEL CHOSE THIS RESPONSE</p>
        <p className="mt-1 text-sm text-slate-200">{explanation}</p>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end border-t border-slate-700 pt-4">
        <div>
          <p className="hud-label">EVENT RESULT</p>
          <p
            className={
              comparison.scoreDelta >= 0
                ? "font-mono text-3xl text-emerald-300"
                : "font-mono text-3xl text-red-300"
            }
          >
            {comparison.scoreDelta >= 0 ? "+" : ""}
            {comparison.scoreDelta} XP
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">
            TOTAL OPERATOR SCORE{" "}
            <span className="text-white">{comparison.human.state.score} XP</span>
            <span className="ml-2 text-slate-500">START 1000</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-slate-400">
          {comparison.scoreBreakdown.map((item) => (
            <span key={item.label}>
              {item.label}{" "}
              <b className={item.value >= 0 ? "text-emerald-300" : "text-red-300"}>
                {item.value >= 0 ? "+" : ""}
                {item.value}
              </b>
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={onAdvance}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-cyan-300 px-4 py-3 font-mono text-xs font-bold tracking-[.16em] text-slate-950"
      >
        {final ? "GENERATE AFTER-ACTION REPORT" : "CONTINUE TO NEXT EVENT"}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function OutcomeCard({
  label,
  outcome,
  other,
}: {
  label: string;
  outcome: Outcome;
  other: Outcome;
}) {
  const s = outcome.state;
  const rows: ReadonlyArray<[string, string, number, number, boolean]> = [
    ["ACTION", outcome.action.shortLabel, 0, 0, false],
    ["UNSERVED LOAD", mw(s.unservedLoadMW), s.unservedLoadMW, other.state.unservedLoadMW, true],
    [
      "RESERVE",
      `${s.reserveMarginPct.toFixed(1)}%`,
      s.reserveMarginPct,
      other.state.reserveMarginPct,
      false,
    ],
    ["FREQUENCY", `${s.frequencyHz.toFixed(2)} Hz`, s.frequencyHz, other.state.frequencyHz, false],
    ["RISK", `${s.systemRisk}%`, s.systemRisk, other.state.systemRisk, true],
    ["COST", money(s.operatingCost), s.operatingCost, other.state.operatingCost, true],
    ["CARBON", `${s.carbonIntensity} kg/MWh`, s.carbonIntensity, other.state.carbonIntensity, true],
    ["OBJECTIVE", outcome.objective.toFixed(2), outcome.objective, other.objective, true],
  ];
  return (
    <div
      className={`rounded border p-4 ${label === "YOU" ? "border-cyan-400/40 bg-cyan-950/10" : "border-emerald-400/40 bg-emerald-950/10"}`}
    >
      <p className="hud-label">{label}</p>
      <dl className="mt-3 space-y-1.5 font-mono text-xs">
        {rows.map(([name, value, own, rival, lowerBetter]) => {
          const better = name !== "ACTION" && (lowerBetter ? own < rival : own > rival);
          const equal = name !== "ACTION" && own === rival;
          return (
            <div key={name} className="flex justify-between gap-2">
              <dt className="text-slate-400">{name}</dt>
              <dd className="text-right text-slate-100">
                {value}{" "}
                {!equal && name !== "ACTION" && (
                  <span className={better ? "ml-1 text-emerald-300" : "ml-1 text-red-300"}>
                    {better ? "BETTER" : "WORSE"}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function comparisonExplanation(comparison: Comparison) {
  const h = comparison.human.state;
  const s = comparison.sentinel.state;
  const reasons: string[] = [];
  if (s.unservedLoadMW < h.unservedLoadMW) reasons.push("reduced unserved load");
  if (s.reserveMarginPct > h.reserveMarginPct) reasons.push("restored more reserve");
  if (s.carbonIntensity < h.carbonIntensity) reasons.push("avoided higher carbon intensity");
  if (s.operatingCost < h.operatingCost) reasons.push("contained operating cost");
  const reason =
    reasons.slice(0, 2).join(" while ") || "produced the lower weighted security objective";
  return `Sentinel selected ${comparison.sentinel.action.shortLabel} because it ${reason}.`;
}

function AfterAction({
  state,
  sentinel,
  results,
  onRestart,
}: {
  state: NightShiftState;
  sentinel: NightShiftState;
  results: readonly Comparison[];
  onRestart: () => void;
}) {
  const score = state.score;
  const rank =
    score >= 1900
      ? "S+ — SENTINEL"
      : score >= 1600
        ? "S — NATIONAL CONTROLLER"
        : score >= 1350
          ? "A — GRID COMMANDER"
          : score >= 1100
            ? "B — SYSTEM OPERATOR"
            : score >= 850
              ? "C — DISPATCHER"
              : "D — GRID INTERN";
  const survived = state.unservedLoadMW === 0 && state.systemRisk < 85;
  const positive = results.filter((result) => result.scoreDelta > 0).length;
  const delayed = results.filter((result) => result.human.action.id === "hold").length;
  const observations = [
    state.cumulativeUnservedMWh > 0
      ? `${state.cumulativeUnservedMWh.toFixed(0)} MWh unserved energy accumulated.`
      : "No unserved energy accumulated.",
    state.carbonIntensity > sentinel.carbonIntensity
      ? "Your final response carried higher carbon intensity than Sentinel."
      : "Your final carbon intensity matched or beat Sentinel.",
    state.peakRisk > sentinel.peakRisk
      ? "Sentinel maintained a lower peak security risk."
      : "Your peak risk matched or beat Sentinel.",
  ].slice(0, 3);
  return (
    <div className="grid-bg min-h-[calc(100vh-104px)] px-5 py-8">
      <div className="panel panel-glow mx-auto max-w-6xl p-6 md:p-10">
        <p className="hud-label text-cyan-300">NIGHT SHIFT // MISSION COMPLETE</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display-md text-white">{survived ? "GRID SURVIVED" : "GRID FAILED"}</h1>
          <p
            className={
              survived ? "font-mono text-xl text-emerald-300" : "font-mono text-xl text-red-300"
            }
          >
            {survived ? "SECURITY ENVELOPE HELD" : "SECURITY ENVELOPE BREACHED"}
          </p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <ReportHero label="OPERATOR" value="JUDGE_01" tone="text-cyan-100" />
          <ReportHero label="FINAL SCORE" value={`${score} XP`} tone="text-emerald-300" />
          <ReportHero label="RANK" value={rank} tone="text-amber-200" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded border border-slate-700 bg-slate-950/45 p-5">
            <p className="hud-label">
              YOU <span className="text-slate-500">vs</span> SENTINEL
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs text-slate-400">
              <span>METRIC</span>
              <span>YOU</span>
              <span>SENTINEL</span>
              {[
                [
                  "Unserved energy",
                  `${state.cumulativeUnservedMWh.toFixed(0)} MWh`,
                  `${sentinel.cumulativeUnservedMWh.toFixed(0)} MWh`,
                ],
                ["Peak risk", `${state.peakRisk}%`, `${sentinel.peakRisk}%`],
                ["Operating cost", money(state.operatingCost), money(sentinel.operatingCost)],
                ["Carbon", `${state.carbonIntensity} kg/MWh`, `${sentinel.carbonIntensity} kg/MWh`],
                [
                  "Security violations",
                  String(results.filter((r) => r.human.state.lineLoading > 100).length),
                  String(results.filter((r) => r.sentinel.state.lineLoading > 100).length),
                ],
                [
                  "Response quality",
                  `${Math.max(0, 100 - state.peakRisk)}%`,
                  `${Math.max(0, 100 - sentinel.peakRisk)}%`,
                ],
              ].map(([label, human, ai]) => (
                <>
                  <span
                    key={`${label}-l`}
                    className="border-t border-slate-800 pt-2 text-slate-200"
                  >
                    {label}
                  </span>
                  <span key={`${label}-h`} className="border-t border-slate-800 pt-2 text-white">
                    {human}
                  </span>
                  <span
                    key={`${label}-s`}
                    className="border-t border-slate-800 pt-2 text-emerald-200"
                  >
                    {ai}
                  </span>
                </>
              ))}
            </div>
          </div>
          <div className="rounded border border-cyan-400/25 bg-cyan-950/10 p-5">
            <p className="hud-label text-cyan-200">WHY YOU RECEIVED THIS RANK</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>
                + {positive} intervention{positive === 1 ? "" : "s"} produced a positive event
                score.
              </li>
              <li>
                {delayed > 0
                  ? `- ${delayed} decision window${delayed === 1 ? "" : "s"} defaulted to Hold / Monitor.`
                  : "+ No decision windows expired."}
              </li>
              <li>
                {state.cumulativeUnservedMWh > 0
                  ? `- ${state.cumulativeUnservedMWh.toFixed(0)} MWh unserved energy.`
                  : "+ No unserved energy."}
              </li>
              <li>
                {state.peakRisk > 70
                  ? `- Peak risk reached ${state.peakRisk}%.`
                  : `+ Peak risk held to ${state.peakRisk}%.`}
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded border border-emerald-400/25 bg-emerald-950/10 p-4">
          <p className="hud-label text-emerald-200">HOW SENTINEL PERFORMED DIFFERENTLY</p>
          <div className="mt-2 grid gap-1 text-sm text-slate-200">
            {observations.map((observation) => (
              <p key={observation}>• {observation}</p>
            ))}
          </div>
        </div>
        <button
          onClick={onRestart}
          className="mt-7 inline-flex items-center gap-2 rounded border border-cyan-300/70 px-5 py-3 font-mono text-xs text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950"
        >
          <Zap size={15} />
          TRY NIGHT SHIFT AGAIN
        </button>
      </div>
    </div>
  );
}
function ReportHero({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-950/55 p-5">
      <p className="hud-label">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function mw(value: number) {
  const sign = value < 0 ? "−" : "";
  return `${sign}${(Math.abs(value) / 1000).toFixed(1)} GW`;
}
function signedMW(value: number) {
  return `${value >= 0 ? "+" : "−"}${(Math.abs(value) / 1000).toFixed(1)} GW`;
}
function signed(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}`;
}
function signedPct(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}
function formatDelta(value: number, unit: string) {
  const precision = unit === "Hz" || unit === "%" ? 2 : unit === "MW" ? 0 : 1;
  return `${Math.abs(value).toFixed(precision)} ${unit}`;
}
function money(value: number) {
  return `$${Math.round(value / 1000).toLocaleString()}k`;
}

const MISSION_META = [
  {
    code: "MISSION 01",
    title: "THE VANISHING SUN",
    subtitle: "RAJASTHAN SOLAR COLLAPSE",
    threat: "RESERVE DEGRADATION",
    character: "ARIA",
  },
  {
    code: "MISSION 02",
    title: "BROKEN LINK",
    subtitle: "MAHARASHTRA ↔ GUJARAT",
    threat: "TRANSMISSION CONTINGENCY",
    character: "KAEL",
  },
  {
    code: "FINAL MISSION",
    title: "BLACK SKY",
    subtitle: "WESTERN GRID CASCADE EVENT",
    threat: "S-TIER THREAT",
    character: "NYX",
  },
] as const;

type CharacterId = "ARIA" | "KAEL" | "NYX";

const CHARACTER = {
  ARIA: {
    role: "GRID INTELLIGENCE OFFICER",
    color: "cyan",
    asset: "/night-shift/aria.webp",
    initials: "A",
    fallback: "FORECAST // OPTIMIZATION",
  },
  KAEL: {
    role: "FIELD OPERATIONS COMMANDER",
    color: "amber",
    asset: "/night-shift/kael.webp",
    initials: "K",
    fallback: "INFRASTRUCTURE // RESPONSE",
  },
  NYX: {
    role: "CRISIS INTELLIGENCE",
    color: "red",
    asset: "/night-shift/nyx.webp",
    initials: "N",
    fallback: "THREAT // CASCADE",
  },
} as const;

function GameIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="min-h-[calc(100vh-104px)] overflow-hidden bg-[#050713] px-5 py-8 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-168px)] max-w-6xl items-center gap-8 lg:grid-cols-[.75fr_1.25fr]">
        <CharacterPortrait character="ARIA" large />
        <div className="relative border border-cyan-400/35 bg-[#080d20]/90 p-7 shadow-[0_0_70px_rgba(34,211,238,.12)] md:p-12">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.16)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative">
            <p className="font-mono text-xs tracking-[.3em] text-cyan-300">
              GRID SENTINEL // NIGHT OPERATIONS
            </p>
            <h1 className="mt-5 font-display text-5xl font-bold leading-none md:text-7xl">
              GRID
              <br />
              <span className="text-cyan-300">SENTINEL</span>
            </h1>
            <p className="mt-4 font-mono text-lg tracking-[.25em] text-slate-300">
              // NIGHT SHIFT //
            </p>
            <div className="mt-8 flex flex-wrap gap-7 border-y border-cyan-400/20 py-4 font-mono text-xs">
              <span>INDIA GRID</span>
              <span>02:17 IST</span>
              <span className="text-emerald-300">ACCESS GRANTED</span>
            </div>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-slate-200">
              <span className="font-mono text-cyan-300">ARIA //</span> Welcome, Operator. Tonight
              you have control of the grid.
            </p>
            <div className="mt-10">
              <p className="hud-label">MISSION OBJECTIVE</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">KEEP THE GRID ONLINE.</p>
            </div>
            <button
              onClick={onBegin}
              className="mt-10 inline-flex items-center gap-3 border border-cyan-300 bg-cyan-300/10 px-6 py-4 font-mono text-sm font-bold tracking-[.18em] text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950"
            >
              BEGIN NIGHT SHIFT <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionBriefing({
  event,
  before,
  after,
  eventIndex,
  onDeploy,
}: {
  event: (typeof EVENTS)[number];
  before: NightShiftState;
  after: NightShiftState;
  eventIndex: number;
  onDeploy: () => void;
}) {
  const meta = MISSION_META[eventIndex];
  const character = meta.character as CharacterId;
  const impact =
    eventIndex === 0
      ? `${signedMW(after.solarMW - before.solarMW)} SOLAR OUTPUT`
      : eventIndex === 1
        ? "LINE TRIPPED // POWER REDISTRIBUTING"
        : "HEATWAVE + WIND LOSS + GENERATOR TRIP";
  return (
    <div
      className={`grid min-h-[calc(100vh-104px)] place-items-center overflow-hidden px-5 py-8 ${eventIndex === 2 ? "bg-red-950/25" : "bg-[#060a18]"}`}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 border border-slate-700 bg-[#090d1f] p-6 shadow-2xl md:grid-cols-[.8fr_1.2fr] md:p-10">
        <CharacterPortrait character={character} large />
        <div className="flex flex-col justify-center">
          <p
            className={
              eventIndex === 2
                ? "font-mono text-xs tracking-[.3em] text-red-300"
                : "font-mono text-xs tracking-[.3em] text-cyan-300"
            }
          >
            {meta.code}
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold text-white md:text-7xl">
            {meta.title}
          </h1>
          <p className="mt-3 font-mono text-lg tracking-[.12em] text-slate-300">{meta.subtitle}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <BriefValue
              label="THREAT"
              value={meta.threat}
              tone={eventIndex === 2 ? "text-red-300" : "text-amber-300"}
            />
            <BriefValue label="IMPACT" value={impact} tone="text-cyan-200" />
            <BriefValue label="REGION" value={event.location} tone="text-slate-200" />
          </div>
          <p className="mt-8 border-l-2 border-cyan-400 pl-4 text-lg text-slate-200">
            {character === "ARIA"
              ? "Western reserve degradation detected. I have calculated my response. Your move."
              : character === "KAEL"
                ? "The corridor is gone. Power is redistributing east. We need a decisive intervention."
                : "Cascade conditions developing. Every second now defines the security envelope."}
          </p>
          <button
            onClick={onDeploy}
            className="mt-9 inline-flex w-fit items-center gap-3 border border-cyan-300 bg-cyan-300 px-6 py-3 font-mono text-xs font-bold tracking-[.18em] text-slate-950"
          >
            DEPLOY TO GRID <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
function BriefValue({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border border-slate-700 bg-slate-950/60 p-3">
      <p className="hud-label">{label}</p>
      <p className={`mt-2 font-mono text-xs ${tone}`}>{value}</p>
    </div>
  );
}

function GameMission({
  event,
  eventIndex,
  state,
  baseline,
  secondsLeft,
  comparison,
  expired,
  onChoose,
  onAdvance,
}: {
  event: (typeof EVENTS)[number];
  eventIndex: number;
  state: NightShiftState;
  baseline: NightShiftState;
  secondsLeft: number;
  comparison: Comparison | null;
  expired: boolean;
  onChoose: (id: ActionId) => void;
  onAdvance: () => void;
}) {
  const meta = MISSION_META[eventIndex];
  const activeCharacter: CharacterId =
    eventIndex === 0 ? "ARIA" : eventIndex === 1 ? "KAEL" : "NYX";
  return (
    <div
      className={`min-h-[calc(100vh-104px)] overflow-hidden px-4 py-4 md:px-6 ${eventIndex === 2 ? "bg-[#160715]" : "bg-[#050817]"}`}
    >
      <div className="mx-auto max-w-[1800px]">
        <GameTopbar state={state} eventIndex={eventIndex} secondsLeft={secondsLeft} />
        <div className="mt-4 grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_390px]">
          <aside className="space-y-4">
            <CharacterPortrait character={activeCharacter} />
            <Comms
              character={activeCharacter}
              event={event}
              state={state}
              baseline={baseline}
              comparison={comparison}
            />
          </aside>
          <main className="min-w-0">
            <div
              className={`relative min-h-[500px] overflow-hidden border ${eventIndex === 2 ? "border-red-500/55 shadow-[0_0_60px_rgba(244,63,94,.18)]" : "border-cyan-400/35"} bg-[#080d20] p-4 md:p-6`}
            >
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.11)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.11)_1px,transparent_1px)] [background-size:46px_46px]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p
                    className={
                      eventIndex === 2 ? "hud-label text-red-300" : "hud-label text-cyan-300"
                    }
                  >
                    {meta.code} // LIVE BATTLEFIELD
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-white">{meta.title}</h2>
                  <p className="font-mono text-xs text-slate-400">{meta.subtitle}</p>
                </div>
                <div className="text-right">
                  <p className="hud-label">GRID STABILITY</p>
                  <p
                    className={
                      state.systemRisk > 60
                        ? "font-mono text-4xl text-red-300"
                        : "font-mono text-4xl text-emerald-300"
                    }
                  >
                    {Math.max(0, 100 - state.systemRisk)}%
                  </p>
                </div>
              </div>
              <DcBattlefield state={state} baseline={baseline} />
              <div className="relative mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Telemetry
                  label="FREQUENCY"
                  value={`${state.frequencyHz.toFixed(2)} Hz`}
                  delta={state.frequencyHz - baseline.frequencyHz}
                  bad={state.frequencyHz < baseline.frequencyHz}
                />
                <Telemetry
                  label="RESERVE"
                  value={`${state.reserveMarginPct.toFixed(1)}%`}
                  delta={state.reserveMarginPct - baseline.reserveMarginPct}
                  bad={state.reserveMarginPct < baseline.reserveMarginPct}
                />
                <Telemetry
                  label="RISK"
                  value={`${state.systemRisk}%`}
                  delta={state.systemRisk - baseline.systemRisk}
                  bad={state.systemRisk > baseline.systemRisk}
                />
                <Telemetry
                  label="UNSERVED"
                  value={mw(state.unservedLoadMW)}
                  delta={state.unservedLoadMW - baseline.unservedLoadMW}
                  bad={state.unservedLoadMW > baseline.unservedLoadMW}
                />
              </div>
            </div>
          </main>
          <aside>
            {comparison ? (
              <RoundResult
                comparison={comparison}
                expired={expired}
                final={eventIndex === 2}
                onAdvance={onAdvance}
              />
            ) : (
              <TacticalDeck
                state={state}
                secondsLeft={secondsLeft}
                onChoose={onChoose}
                eventIndex={eventIndex}
              />
            )}
            <ScenarioBuilder />
          </aside>
        </div>
      </div>
    </div>
  );
}

function GameTopbar({
  state,
  eventIndex,
  secondsLeft,
}: {
  state: NightShiftState;
  eventIndex: number;
  secondsLeft: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border border-slate-700 bg-slate-950/75 px-4 py-3 font-mono">
      <div>
        <p className="hud-label">NIGHT SHIFT</p>
        <p className="text-sm text-cyan-200">GRID SENTINEL DIVISION</p>
      </div>
      <div className="flex gap-3 text-[10px]">
        {MISSION_META.map((mission, index) => (
          <div
            key={mission.code}
            className={
              index === eventIndex
                ? "text-cyan-200"
                : index < eventIndex
                  ? "text-emerald-300"
                  : "text-slate-600"
            }
          >
            MISSION 0{index + 1}{" "}
            {index < eventIndex ? "● COMPLETE" : index === eventIndex ? "◉ ACTIVE" : "○ LOCKED"}
          </div>
        ))}
      </div>
      <div className="ml-auto flex gap-5">
        <div>
          <p className="hud-label">SYSTEM FREQ</p>
          <p className="text-lg text-cyan-200">{state.frequencyHz.toFixed(2)} Hz</p>
        </div>
        <div>
          <p className="hud-label">OPERATOR XP</p>
          <p className="text-lg text-emerald-300">{state.score}</p>
        </div>
        <div className={secondsLeft <= 3 ? "text-red-300 animate-pulse" : "text-amber-200"}>
          <p className="hud-label">DECISION</p>
          <p className="text-lg">00:{String(secondsLeft).padStart(2, "0")}</p>
        </div>
      </div>
    </div>
  );
}

function Battlefield({ state, eventIndex }: { state: NightShiftState; eventIndex: number }) {
  const tripped = eventIndex > 0;
  const critical = state.lineLoading > 100;
  const flow = critical ? "#fb7185" : state.lineLoading > 90 ? "#fbbf24" : "#22d3ee";
  const paths = [
    { d: "M90 80 L260 120", status: eventIndex === 0 ? "watch" : "healthy", label: "RAJASTHAN" },
    {
      d: "M260 120 L490 190",
      status: tripped ? "tripped" : "healthy",
      label: "GUJARAT - MAHARASHTRA",
    },
    {
      d: "M140 215 L375 170",
      status: tripped ? "critical" : "healthy",
      label: "WESTERN REDISTRIBUTION",
    },
    {
      d: "M375 170 L590 75",
      status: eventIndex === 2 ? "critical" : "healthy",
      label: "NORTHBOUND FLOW",
    },
    {
      d: "M140 215 L490 190",
      status: eventIndex === 2 ? "critical" : "healthy",
      label: "SOUTHERN RELIEF",
    },
  ] as const;
  const nodes = [
    [90, 80, "RAJASTHAN"],
    [260, 120, "GUJARAT"],
    [140, 215, "MUMBAI"],
    [375, 170, "M.P."],
    [490, 190, "MAHARASHTRA"],
    [590, 75, "DELHI"],
  ] as const;
  return (
    <div className="relative mt-4 h-[330px]">
      <svg
        viewBox="0 0 680 290"
        className="h-full w-full"
        role="img"
        aria-label="Night Shift transmission battlefield"
      >
        {paths.map((path, index) => {
          const color =
            path.status === "tripped"
              ? "#475569"
              : path.status === "critical"
                ? "#fb7185"
                : path.status === "watch"
                  ? "#fbbf24"
                  : flow;
          return (
            <g key={path.label}>
              <path d={path.d} fill="none" stroke="#13243e" strokeWidth="13" />
              <path
                d={path.d}
                fill="none"
                stroke={color}
                strokeWidth={path.status === "tripped" ? 3 : 6}
                strokeDasharray={path.status === "tripped" ? "9 12" : "14 9"}
                className={path.status === "tripped" ? "opacity-45" : "animate-dash"}
              />
              <text
                x={index % 2 ? 340 : 230}
                y={58 + index * 43}
                fill={color}
                fontSize="10"
                fontFamily="monospace"
              >
                {path.status === "tripped"
                  ? "× LINK TRIPPED"
                  : `${path.label} // ${Math.min(118, Math.max(72, state.lineLoading + index * 3 - 8))}%`}
              </text>
            </g>
          );
        })}
        {nodes.map(([x, y, label]) => (
          <g key={label}>
            <circle
              cx={x}
              cy={y}
              r="17"
              fill="#070b17"
              stroke={label === "GUJARAT" || label === "MAHARASHTRA" ? flow : "#67e8f9"}
              strokeWidth="3"
            />
            <circle cx={x} cy={y} r="5" fill="#a7f3d0" className="animate-pulse" />
            <text x={x + 22} y={y - 18} fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-1 left-1 font-mono text-[10px] text-slate-500">
        ENERGY FLOW // CYAN HEALTHY · AMBER WATCH · RED CRITICAL · DIM TRIPPED
      </div>
    </div>
  );
}

function DcBattlefield({ state, baseline }: { state: NightShiftState; baseline: NightShiftState }) {
  const trip = state.networkPowerFlow.lineFlows.find((line) => line.status === "tripped");
  const before =
    trip && baseline.networkPowerFlow.lineFlows.find((line) => line.lineId === trip.lineId);
  return (
    <div className="relative mt-4">
      <p className="font-mono text-[10px] text-cyan-200">
        {trip ? "N-1 ANALYSIS // HYPOTHETICAL OUTAGE STATE" : "BASE CASE // DC POWER FLOW"}
      </p>
      <DcNetworkView buses={state.networkBuses} powerFlow={state.networkPowerFlow} />
      {trip && before && (
        <p className="font-mono text-[10px] text-amber-200">
          {trip.lineId.toUpperCase()} // BEFORE {Math.round(before.flowMW)} MW // OUTAGE 0 MW
        </p>
      )}
      <div className="font-mono text-[10px] text-slate-500">
        ENERGY FLOW DIRECTION FOLLOWS SIGNED DC MW // CYAN SAFE · AMBER WATCH · RED OVERLOAD · DIM
        TRIPPED
      </div>
    </div>
  );
}

function Telemetry({
  label,
  value,
  delta,
  bad,
}: {
  label: string;
  value: string;
  delta: number;
  bad: boolean;
}) {
  return (
    <div className="border border-slate-700 bg-slate-950/80 p-2">
      <p className="hud-label">{label}</p>
      <p className="font-mono text-base text-white">{value}</p>
      <p
        className={
          delta === 0
            ? "font-mono text-[10px] text-slate-500"
            : bad
              ? "font-mono text-[10px] text-red-300"
              : "font-mono text-[10px] text-emerald-300"
        }
      >
        {delta === 0
          ? "NO CHANGE"
          : `${bad ? "▼" : "▲"} ${Math.abs(delta).toFixed(label === "FREQUENCY" ? 2 : 1)}`}
      </p>
    </div>
  );
}

function TacticalDeck({
  state,
  secondsLeft,
  onChoose,
  eventIndex,
}: {
  state: NightShiftState;
  secondsLeft: number;
  onChoose: (id: ActionId) => void;
  eventIndex: number;
}) {
  const outcomes = useMemo(
    () => ACTIONS.map((action) => evaluateAction(state, action.id)),
    [state],
  );
  return (
    <div
      className={`border bg-[#090d20] p-4 ${eventIndex === 2 ? "border-red-500/60" : "border-cyan-400/30"}`}
    >
      <p className="hud-label text-amber-200">OPERATOR DECISION REQUIRED</p>
      <div
        className={
          secondsLeft < 4
            ? "mt-2 font-mono text-6xl text-red-300 animate-pulse"
            : "mt-2 font-mono text-6xl text-cyan-200"
        }
      >
        {String(secondsLeft).padStart(2, "0")}
      </div>
      <p className="mt-2 border-l-2 border-cyan-400 pl-3 text-sm text-slate-300">
        <span className="font-mono text-cyan-300">ARIA //</span> I have calculated my response. Your
        move.
      </p>
      <div className="mt-4 space-y-2">
        {outcomes.map((outcome, index) => (
          <TacticalCard
            key={outcome.action.id}
            outcome={outcome}
            index={index}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
}

function TacticalCard({
  outcome,
  index,
  onChoose,
}: {
  outcome: Outcome;
  index: number;
  onChoose: (id: ActionId) => void;
}) {
  const action = outcome.action.id;
  const spec =
    action === "bess"
      ? ["BESS OVERRIDE", "+4.5 GW", "INSTANT", "LOW", "₹₹"]
      : action === "thermal"
        ? ["THERMAL SURGE", "+6.0 GW", "FAST", "HIGH", "₹₹₹"]
        : action === "demand-response"
          ? ["DEMAND RESPONSE", "−3.5 GW LOAD", "FAST", "LOW", "₹₹"]
          : ["HOLD POSITION", "NO INTERVENTION", "NONE", "LOW", "LOW"];
  return (
    <button
      onClick={() => onChoose(action)}
      className="group w-full border border-slate-700 bg-slate-950/70 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-300/10"
    >
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-slate-500">
          [{String(index + 1).padStart(2, "0")}]
        </span>
        <span className="font-mono text-[10px] text-slate-500">J HIDDEN</span>
      </div>
      <p className="mt-1 font-display text-base text-white">{spec[0]}</p>
      <p className="font-mono text-sm text-cyan-200">{spec[1]}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[9px] text-slate-400">
        <span>
          RESPONSE
          <br />
          <b className="text-slate-200">{spec[2]}</b>
        </span>
        <span>
          CARBON
          <br />
          <b className={spec[3] === "HIGH" ? "text-red-300" : "text-emerald-300"}>{spec[3]}</b>
        </span>
        <span>
          COST
          <br />
          <b className="text-amber-200">{spec[4]}</b>
        </span>
      </div>
    </button>
  );
}

function Comms({
  character,
  event,
  state,
  baseline,
  comparison,
}: {
  character: CharacterId;
  event: (typeof EVENTS)[number];
  state: NightShiftState;
  baseline: NightShiftState;
  comparison: Comparison | null;
}) {
  const tripped = state.networkPowerFlow.lineFlows.find(
    (corridor) => corridor.status === "tripped",
  );
  const redistributed = state.networkPowerFlow.lineFlows
    .filter((corridor) => corridor.status !== "tripped")
    .map((corridor) => ({
      corridor,
      before: baseline.networkPowerFlow.lineFlows.find(
        (candidate) => candidate.lineId === corridor.lineId,
      ),
    }))
    .sort(
      (left, right) =>
        right.corridor.loadingPct -
        (right.before?.loadingPct ?? 0) -
        (left.corridor.loadingPct - (left.before?.loadingPct ?? 0)),
    )[0];
  const line =
    state.controlEnvelopeStatus === "CONTROL_ENVELOPE_EXHAUSTED"
      ? "Corrective control envelope exhausted. No available modeled intervention fully restores secure operation."
      : comparison
        ? comparison.human.action.id === comparison.sentinel.action.id
          ? "Decision matched the minimum-risk solution."
          : state.systemRisk < 45
            ? "Grid stabilized. Economic efficiency remains under review."
            : "Your response improved the grid, but the security margin is still thin."
        : character === "KAEL" && tripped && redistributed
          ? `${tripped.lineId.toUpperCase()} corridor lost. ${redistributed.corridor.lineId.toUpperCase()} loading increased from ${(redistributed.before?.loadingPct ?? 0).toFixed(1)}% to ${redistributed.corridor.loadingPct.toFixed(1)}%.`
          : character === "NYX"
            ? "Reserve threshold breached. Secondary corridor overload detected."
            : "Western reserve degradation detected. Four interventions evaluated.";
  return (
    <div
      className={`border p-4 ${character === "NYX" ? "border-red-400/40 bg-red-950/15" : character === "KAEL" ? "border-amber-400/40 bg-amber-950/10" : "border-cyan-400/35 bg-cyan-950/10"}`}
    >
      <p className="hud-label">{character} // SECURE COMMS</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-200">“{line}”</p>
      <p className="mt-3 font-mono text-[10px] text-slate-500">
        SSI {state.ssi} // {state.ssiGrade.toUpperCase()} · RISK {state.systemRisk}% · EUE{" "}
        {state.expectedUnservedEnergyMWh} MWh · CONFIDENCE {state.operatorConfidencePct}%
      </p>
      <p className="mt-2 font-mono text-[10px] text-slate-500">
        {state.sentinelReasons.slice(0, 3).join(" ")}
      </p>
      {state.controlEnvelopeStatus === "CONTROL_ENVELOPE_EXHAUSTED" && (
        <p className="mt-2 font-mono text-[10px] text-red-300">
          CONTROL_ENVELOPE_EXHAUSTED // EUE {state.expectedUnservedEnergyMWh} MWh // SSI {state.ssi}{" "}
          // {state.validation.overallGrade}
        </p>
      )}
      <p
        className={
          state.validation.overallGrade === "PASS"
            ? "mt-2 font-mono text-[10px] text-emerald-300"
            : "mt-2 font-mono text-[10px] text-amber-300"
        }
      >
        {state.validation.overallGrade === "PASS"
          ? "ENGINEERING VALIDATION // PASS"
          : `SIMULATION WARNING // ${state.validation.overallGrade}`}{" "}
        · {state.validation.passedConstraints.length} PASSED ·{" "}
        {state.validation.brokenConstraints.length} FAILED · INTEGRITY{" "}
        {state.validation.validationScore}/100
      </p>
    </div>
  );
}

function CharacterPortrait({
  character,
  large = false,
}: {
  character: CharacterId;
  large?: boolean;
}) {
  const info = CHARACTER[character];
  const tone =
    info.color === "red"
      ? "border-red-400/50 bg-red-950/20 text-red-200"
      : info.color === "amber"
        ? "border-amber-400/50 bg-amber-950/20 text-amber-200"
        : "border-cyan-400/50 bg-cyan-950/20 text-cyan-200";
  return (
    <div
      className={`relative overflow-hidden border ${tone} ${large ? "min-h-[300px]" : "min-h-[245px]"}`}
    >
      <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(180deg,transparent_0px,transparent_4px,rgba(255,255,255,.25)_5px)]" />
      <img
        src={info.asset}
        alt=""
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-x-[26%] bottom-0 top-[18%] rounded-t-[48%] bg-gradient-to-b from-slate-500/35 via-slate-900/80 to-slate-950" />
      <div className="absolute inset-x-[38%] top-[9%] h-20 rounded-full bg-slate-300/15 blur-sm" />
      <div className="absolute bottom-4 left-4">
        <p className="font-display text-5xl font-bold opacity-80">{info.initials}</p>
        <p className="font-mono text-xs tracking-[.18em]">{character}</p>
        <p className="font-mono text-[9px] text-slate-300">{info.role}</p>
      </div>
      <div className="absolute right-3 top-3 font-mono text-[8px] text-slate-400">
        ART SLOT // {info.asset}
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400">
        {info.fallback}
      </div>
    </div>
  );
}

function RoundResult({
  comparison,
  expired,
  final,
  onAdvance,
}: {
  comparison: Comparison;
  expired: boolean;
  final: boolean;
  onAdvance: () => void;
}) {
  const humanWins = comparison.human.objective < comparison.sentinel.objective;
  const same = comparison.human.objective === comparison.sentinel.objective;
  const rows: ReadonlyArray<[string, string, string]> = [
    ["ACTION", comparison.human.action.shortLabel, comparison.sentinel.action.shortLabel],
    ["RELIABILITY", `${comparison.human.reliability}%`, `${comparison.sentinel.reliability}%`],
    [
      "UNSERVED LOAD",
      mw(comparison.human.state.unservedLoadMW),
      mw(comparison.sentinel.state.unservedLoadMW),
    ],
    [
      "COST",
      money(comparison.human.state.operatingCost),
      money(comparison.sentinel.state.operatingCost),
    ],
    [
      "CARBON",
      `${comparison.human.state.carbonIntensity}`,
      `${comparison.sentinel.state.carbonIntensity}`,
    ],
    ["RISK", `${comparison.human.state.systemRisk}%`, `${comparison.sentinel.state.systemRisk}%`],
    ["OBJECTIVE", comparison.human.objective.toFixed(2), comparison.sentinel.objective.toFixed(2)],
  ];
  return (
    <div className="border border-violet-400/45 bg-[#100c24] p-5 shadow-[0_0_35px_rgba(139,92,246,.16)]">
      <p className="hud-label text-violet-200">ROUND RESULT</p>
      <h2 className="mt-2 font-display text-3xl text-white">
        {same ? "DRAW" : humanWins ? "OPERATOR +1" : "SENTINEL +1"}
      </h2>
      {expired && (
        <p className="mt-2 font-mono text-[10px] text-amber-300">
          DECISION WINDOW EXPIRED // HOLD POSITION EXECUTED
        </p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-violet-400/20 py-3 font-mono text-[10px]">
        <span className="text-cyan-200">YOU</span>
        <span className="text-slate-500">METRIC</span>
        <span className="text-emerald-200">SENTINEL</span>
        {rows.map(([label, human, ai]) => (
          <>
            <span key={`${label}h`} className="text-slate-100">
              {human}
            </span>
            <span key={`${label}l`} className="text-slate-500">
              {label}
            </span>
            <span key={`${label}s`} className="text-slate-100">
              {ai}
            </span>
          </>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-300">
        <span className="font-mono text-cyan-300">ARIA //</span>{" "}
        {humanWins
          ? "Your decision produced the lower weighted objective."
          : `Sentinel selected ${comparison.sentinel.action.shortLabel} with the lower weighted objective.`}
      </p>
      <p className="mt-2 font-mono text-[10px] text-slate-500">
        CONFIDENCE {comparison.sentinel.state.operatorConfidencePct}% · EXPECTED IMPROVEMENT{" "}
        {Math.max(0, comparison.human.state.systemRisk - comparison.sentinel.state.systemRisk)} RISK
        PTS
      </p>
      <p className="mt-1 font-mono text-[10px] text-slate-500">
        TOP REASONS: {comparison.sentinel.state.sentinelReasons.slice(0, 3).join(" ")}
      </p>
      <p className="mt-2 font-mono text-[10px] text-slate-500">
        ENGINEERING VALIDATION: {comparison.human.state.validation.overallGrade} ·{" "}
        {comparison.human.state.validation.passedConstraints.length} PASSED ·{" "}
        {comparison.human.state.validation.brokenConstraints.length} FAILED · CONFIDENCE{" "}
        {comparison.human.state.validation.confidencePct}%
      </p>
      <div className="mt-4 border-t border-violet-400/20 pt-3">
        <p className="hud-label">EVENT XP</p>
        <p
          className={
            comparison.scoreDelta >= 0
              ? "font-mono text-3xl text-emerald-300"
              : "font-mono text-3xl text-red-300"
          }
        >
          {comparison.scoreDelta >= 0 ? "+" : ""}
          {comparison.scoreDelta} XP
        </p>
      </div>
      <button
        onClick={onAdvance}
        className="mt-5 flex w-full items-center justify-center gap-2 bg-violet-300 px-4 py-3 font-mono text-xs font-bold tracking-[.14em] text-slate-950"
      >
        {final ? "REVEAL OPERATOR CLASSIFICATION" : "NEXT MISSION"}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function GameReport({
  state,
  sentinel,
  results,
  onRestart,
}: {
  state: NightShiftState;
  sentinel: NightShiftState;
  results: readonly Comparison[];
  onRestart: () => void;
}) {
  const rank =
    state.score >= 1900
      ? ["S+", "SENTINEL"]
      : state.score >= 1600
        ? ["S", "NATIONAL CONTROLLER"]
        : state.score >= 1350
          ? ["A", "GRID COMMANDER"]
          : state.score >= 1100
            ? ["B", "SYSTEM OPERATOR"]
            : state.score >= 850
              ? ["C", "DISPATCHER"]
              : ["D", "GRID INTERN"];
  const survived = state.systemRisk < 85 && state.unservedLoadMW === 0;
  const reliability = Math.max(0, 100 - state.peakRisk);
  const economics = Math.max(0, 100 - Math.round(state.operatingCost / 10000));
  const sustainability = Math.max(0, 100 - Math.round(state.carbonIntensity / 8));
  const response = Math.max(0, 100 - state.systemRisk);
  const aiLine =
    state.cumulativeUnservedMWh === 0
      ? "Western Grid survived. No critical demand was lost."
      : `Western Grid survived with ${state.cumulativeUnservedMWh.toFixed(0)} MWh of unserved energy.`;
  return (
    <div className="min-h-[calc(100vh-104px)] bg-[#060817] px-5 py-8 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[.65fr_1.35fr]">
        <CharacterPortrait character="ARIA" large />
        <div className="border border-violet-400/40 bg-[#0d0a20] p-7 shadow-[0_0_70px_rgba(139,92,246,.14)] md:p-10">
          <p className="hud-label text-violet-200">NIGHT SHIFT // FINAL SEQUENCE</p>
          <h1
            className={
              survived
                ? "mt-2 font-display text-5xl text-emerald-300 md:text-7xl"
                : "mt-2 font-display text-5xl text-red-300 md:text-7xl"
            }
          >
            {survived ? "MISSION COMPLETE" : "GRID FAILURE"}
          </h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-[.65fr_1.35fr]">
            <div className="border border-violet-400/30 bg-violet-950/20 p-5">
              <p className="hud-label">OPERATOR CLASSIFICATION</p>
              <p className="mt-2 font-display text-8xl text-violet-200">{rank[0]}</p>
              <p className="font-mono text-sm text-slate-200">{rank[1]}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["RELIABILITY", reliability],
                ["ECONOMICS", economics],
                ["SUSTAINABILITY", sustainability],
                ["CRISIS RESPONSE", response],
              ].map(([label, value]) => (
                <div key={String(label)} className="border border-slate-700 bg-slate-950/60 p-3">
                  <p className="hud-label">{label}</p>
                  <p className="font-mono text-3xl text-cyan-200">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 border-l-2 border-cyan-400 pl-4 text-lg text-slate-200">
            <span className="font-mono text-cyan-300">ARIA //</span> {aiLine}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-2 border-y border-slate-700 py-4 font-mono text-xs">
            <span>
              FINAL XP <b className="block mt-1 text-xl text-emerald-300">{state.score}</b>
            </span>
            <span>
              PEAK RISK <b className="block mt-1 text-xl text-red-300">{state.peakRisk}%</b>
            </span>
            <span>
              SENTINEL J{" "}
              <b className="block mt-1 text-xl text-cyan-200">
                {results.at(-1)?.sentinel.objective.toFixed(2) ?? "—"}
              </b>
            </span>
          </div>
          <button
            onClick={onRestart}
            className="mt-7 inline-flex items-center gap-2 border border-cyan-300 px-5 py-3 font-mono text-xs font-bold tracking-[.14em] text-cyan-100 hover:bg-cyan-300 hover:text-slate-950"
          >
            <Zap size={15} />
            CHALLENGE SENTINEL AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}
