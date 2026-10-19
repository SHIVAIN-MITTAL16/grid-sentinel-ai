import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Activity, BellRing, CheckCircle2, Clock3, Database, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";

const runEarlyWarningCheck = createServerFn({ method: "POST" }).handler(async () => {
  const { evaluateForecastRisk } = await import("@/services/forecast-risk");
  const { savePreCrisisAlert } = await import("@/services/alert-store");
  const risk = await evaluateForecastRisk();
  let persisted = false;
  let persistenceNotice = "No alert met the threshold; no new record was created.";
  if (risk.trigger) {
    const eventHour = risk.generatedAt.slice(0, 13);
    const eventKey = ["precrisis", risk.highestRiskState.toLowerCase().replace(/[^a-z0-9]+/g, "-"), eventHour, String(risk.thresholdPercent)].join(":");
    try {
      await savePreCrisisAlert({
        event_key: eventKey,
        generated_at: risk.generatedAt,
        projected_probability_percent: risk.projectedShortfallProbabilityPercent,
        threshold_percent: risk.thresholdPercent,
        horizon_hours: risk.horizonHours,
        highest_risk_state: risk.highestRiskState,
        forecast_hazard_score: risk.forecastHazardScore,
        model_notice: risk.modelNotice,
        notification_status: "not_sent",
        provider_message_id: null,
      });
      persisted = true;
      persistenceNotice = "Threshold crossed. Alert persisted or already recorded; no SMS was sent.";
    } catch {
      persistenceNotice = "Threshold crossed, but Supabase persistence failed. Check the server credentials and migration; no SMS was sent.";
    }
  }
  return { risk, persisted, persistenceNotice };
});

const loadAlertHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { listPreCrisisAlerts } = await import("@/services/alert-store");
  return listPreCrisisAlerts(20);
});

type Alert = {
  id?: string;
  event_key: string;
  created_at?: string;
  generated_at: string;
  projected_probability_percent: number;
  threshold_percent: number;
  horizon_hours: number;
  highest_risk_state: string;
  notification_status: string;
};

export const Route = createFileRoute("/pre-crisis-alerts")({
  head: () => ({ meta: [{ title: "Pre-crisis Alerts · Grid Sentinel AI" }, { name: "description", content: "Manually evaluate forecast-adjusted grid risk and review persistent early-warning alerts." }] }),
  component: PreCrisisAlertsPage,
});

function PreCrisisAlertsPage() {
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [assessment, setAssessment] = useState<Awaited<ReturnType<typeof runEarlyWarningCheck>> | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setAlerts(await loadAlertHistory() as Alert[]);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load alert history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  async function runCheck() {
    setLoading(true);
    setError("");
    try {
      const result = await runEarlyWarningCheck();
      setAssessment(result);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk check failed.");
    } finally {
      setLoading(false);
    }
  }

  const risk = assessment?.risk;
  return <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_80%_0%,rgba(8,145,178,.18),transparent_45%),linear-gradient(135deg,#071426,#050a15_72%)] p-6 sm:p-8">
      <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-cyan-400/[0.06] blur-3xl"/>
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><BellRing size={15}/> Risk intelligence <span className="text-slate-600">/</span> manual mode</div><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Pre-crisis <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">Early Warning</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Run an on-demand forecast check, flag elevated shortfall risk and preserve a traceable alert history. No background monitoring or automatic SMS sending is enabled.</p></div>
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3"><Clock3 size={18} className="text-amber-200"/><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Monitoring</div><div className="mt-0.5 text-sm font-medium text-slate-100">Manual only</div></div></div>
      </div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
      <section className="rounded-2xl border border-cyan-300/15 bg-[linear-gradient(145deg,rgba(10,25,46,.94),rgba(4,10,23,.96))] shadow-[0_18px_70px_-35px_rgba(34,211,238,.3)]">
        <div className="border-b border-white/[0.06] px-5 py-4"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">01 · On-demand evaluation</div><h2 className="mt-1 text-xl font-semibold text-slate-100">Forecast-adjusted grid risk</h2></div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-3"><Metric label="Alert threshold" value="20%" icon={<ShieldAlert size={17}/>}/><Metric label="Forecast horizon" value="24 hours" icon={<Activity size={17}/>}/><Metric label="Data inputs" value="Hybrid" icon={<Database size={17}/>}/></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Combines Open-Meteo hourly forecast hazards with the existing seeded Monte Carlo baseline. This is a heuristic estimate, not a calibrated operational probability.</p>
          <button type="button" onClick={() => void runCheck()} disabled={loading} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_-12px_rgba(34,211,238,.8)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{loading ? <RefreshCw size={17} className="animate-spin"/> : <Activity size={17}/>} {loading ? "Evaluating forecast…" : "Run early-warning check"}</button>
          {error && <div role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-3 text-sm text-rose-200">{error}</div>}
          {risk && <div className="mt-5 rounded-2xl border border-cyan-200/15 bg-slate-950/55 p-4 animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-500">Projected shortfall risk</div><div className="mt-2 text-4xl font-semibold tracking-tight text-white">{risk.projectedShortfallProbabilityPercent.toFixed(1)}<span className="text-xl text-slate-400">%</span></div></div><span className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (risk.trigger ? "border-rose-300/30 bg-rose-300/[0.08] text-rose-200" : "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200")}>{risk.trigger ? "Threshold crossed" : "Below threshold"}</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className={"h-full rounded-full transition-all duration-700 " + (risk.trigger ? "bg-rose-300" : "bg-gradient-to-r from-cyan-400 to-emerald-300")} style={{width: Math.min(100, risk.projectedShortfallProbabilityPercent) + "%"}}/></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Mini label="Highest forecast hazard" value={risk.highestRiskState}/><Mini label="Forecast hazard score" value={String(risk.forecastHazardScore) + " / 100"}/><Mini label="Monte Carlo baseline" value={risk.baselineMonteCarloProbabilityPercent.toFixed(1) + "%"}/><Mini label="Evaluation horizon" value={String(risk.horizonHours) + " hours"}/></div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-5 text-slate-400"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-300"/><span>{assessment.persistenceNotice} {risk.modelNotice}</span></div>
          </div>}
        </div>
      </section>
      <section className="rounded-2xl border border-violet-300/15 bg-[linear-gradient(145deg,rgba(20,18,48,.72),rgba(4,10,23,.96))]">
        <div className="border-b border-white/[0.06] px-5 py-4"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/75">02 · Notification channel</div><h2 className="mt-1 text-xl font-semibold text-slate-100">SMS readiness</h2></div>
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.04] p-4"><Smartphone size={20} className="mt-0.5 shrink-0 text-cyan-200"/><div><div className="text-sm font-semibold text-slate-100">MSG91 adapter prepared</div><p className="mt-1 text-xs leading-5 text-slate-400">Provider integration is server-side. Delivery is intentionally not invoked by this page.</p></div></div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4"><ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-200"/><div><div className="text-sm font-semibold text-amber-100">Real sending is disabled by default</div><p className="mt-1 text-xs leading-5 text-slate-400">No SMS has been sent. A real test requires your separate explicit confirmation before any send attempt.</p></div></div>
          <div className="rounded-xl border border-white/[0.06] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-500">Required setup</div><ul className="mt-3 space-y-2 text-xs text-slate-300"><li>• Supabase server credentials and alert table</li><li>• MSG91 key, approved template and sender ID</li><li>• Applicable Indian DLT registration</li></ul><p className="mt-3 text-xs leading-5 text-slate-500">See docs/PRE_CRISIS_SMS_SETUP.md. No credentials are required to view this page.</p></div>
        </div>
      </section>
    </div>
    <section className="rounded-2xl border border-cyan-300/15 bg-[linear-gradient(145deg,rgba(10,25,46,.94),rgba(4,10,23,.96))]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">03 · Persistent record</div><h2 className="mt-1 text-xl font-semibold text-slate-100">Alert history</h2></div><button type="button" onClick={() => void refreshHistory()} disabled={historyLoading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-200/25 hover:text-white disabled:opacity-60"><RefreshCw size={14} className={historyLoading ? "animate-spin" : ""}/> Refresh history</button></div>
      <div className="p-5">
        {historyError && <div role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-3 text-sm text-amber-100">{historyError} Set up Supabase using the project guide to enable persistence.</div>}
        {!historyError && historyLoading && <p className="text-sm text-slate-400">Loading saved alerts…</p>}
        {!historyError && !historyLoading && alerts.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center"><BellRing size={23} className="mx-auto text-slate-500"/><p className="mt-3 text-sm font-medium text-slate-200">No saved alerts yet</p><p className="mt-1 text-xs text-slate-500">Run a manual check. Records are created when the 20% threshold is crossed.</p></div>}
        {alerts.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-3 py-3 font-semibold">Generated</th><th className="px-3 py-3 font-semibold">Risk</th><th className="px-3 py-3 font-semibold">Region</th><th className="px-3 py-3 font-semibold">Horizon</th><th className="px-3 py-3 font-semibold">SMS status</th></tr></thead><tbody>{alerts.map((alert) => <tr key={alert.event_key} className="border-t border-white/[0.06]"><td className="px-3 py-3 text-xs text-slate-300">{new Date(alert.generated_at).toLocaleString()}</td><td className="px-3 py-3 font-semibold text-rose-200">{Number(alert.projected_probability_percent).toFixed(1)}%</td><td className="px-3 py-3 text-slate-200">{alert.highest_risk_state}</td><td className="px-3 py-3 text-slate-300">{alert.horizon_hours}h</td><td className="px-3 py-3"><span className="rounded-full border border-slate-300/15 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">{alert.notification_status.replace("_", " ")}</span></td></tr>)}</tbody></table></div>}
      </div>
    </section>
    <p className="text-xs leading-5 text-slate-500">Operational disclaimer: the current project does not include live SCADA/PMU telemetry or a validated power-flow solver. Treat these results as research/demo estimates, not as sole inputs to dispatch or emergency decisions.</p>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-cyan-200/10 bg-slate-950/50 p-3"><div className="flex items-center justify-between text-slate-400"><span className="text-[10px] font-semibold uppercase tracking-[0.13em]">{label}</span><span className="text-cyan-300">{icon}</span></div><div className="mt-2 text-lg font-semibold tracking-tight text-slate-100">{value}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[10px] uppercase tracking-[0.13em] text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-200">{value}</div></div>;
}
