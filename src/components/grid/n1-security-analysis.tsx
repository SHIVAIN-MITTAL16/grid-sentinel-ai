import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, RotateCcw, Shield, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { IndiaGeoMap } from "@/components/grid/india-geo-map";
import { STATES } from "@/lib/grid-data";

type ComponentKind = "Transmission line" | "Generator" | "Substation";
type Contingency = { id: string; name: string; kind: ComponentKind; baseLoading: number; affected: string };

const CONTINGENCIES: Contingency[] = [
  { id: "mp-delhi", name: "MP–Delhi 765 kV corridor", kind: "Transmission line", baseLoading: 68, affected: "North–Central transfer" },
  { id: "rajasthan-delhi", name: "Rajasthan–Delhi 765 kV corridor", kind: "Transmission line", baseLoading: 52, affected: "Rajasthan–Delhi transfer" },
  { id: "gujarat-maharashtra", name: "Gujarat–Maharashtra 765 kV corridor", kind: "Transmission line", baseLoading: 48, affected: "Western regional transfer" },
  { id: "northern-generator", name: "Northern regional generator", kind: "Generator", baseLoading: 44, affected: "Northern supply balance" },
  { id: "central-substation", name: "Central India 400 kV substation", kind: "Substation", baseLoading: 39, affected: "Central network connectivity" },
];

function Metric({ label, value, tone = "cyan" }: { label: string; value: string; tone?: "cyan" | "green" | "amber" | "rose" }) {
  const tones = {
    cyan: "text-cyan-200 border-cyan-300/20",
    green: "text-emerald-300 border-emerald-300/20",
    amber: "text-amber-200 border-amber-300/20",
    rose: "text-rose-300 border-rose-300/20",
  };
  return <div className={"rounded-xl border bg-slate-950/55 p-4 " + tones[tone]}><div className="text-[11px] font-semibold uppercase tracking-[0.17em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</div></div>;
}

function Panel({ title, eyebrow, children, className = "" }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <section className={"rounded-2xl border border-cyan-300/15 bg-[linear-gradient(145deg,rgba(10,25,46,.94),rgba(4,10,23,.96))] shadow-[0_18px_70px_-35px_rgba(34,211,238,.35)] " + className}><div className="border-b border-white/[0.06] px-5 py-4"><div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">{eyebrow || "GRID SENTINEL · DIGITAL TWIN"}</div><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">{title}</h3></div><div className="p-4 sm:p-5">{children}</div></section>;
}

export function N1SecurityAnalysis() {
  const [selectedId, setSelectedId] = useState(CONTINGENCIES[0].id);
  const [result, setResult] = useState(false);
  const selected = useMemo(() => CONTINGENCIES.find((item) => item.id === selectedId) || CONTINGENCIES[0], [selectedId]);
  const estimatedLoading = Math.min(99.5, selected.baseLoading + (selected.kind === "Transmission line" ? 18 : 13));
  const estimatedViolations = estimatedLoading >= 90 ? 1 : 0;
  return <div className="space-y-5">
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_75%_0%,rgba(14,116,144,.2),transparent_45%),linear-gradient(135deg,#071426,#050a15_70%)] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-400/[0.07] blur-3xl"/>
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300"><Shield size={15}/> Reliability engineering <span className="text-slate-600">/</span> 01</div><h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">N-1 <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300 bg-clip-text text-transparent">Security Analysis</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Stress-test the grid against the loss of one component. Identify where power may reroute, which constraints deserve attention, and when an operator should investigate.</p></div>
        <div className="flex items-center gap-3 self-start rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 lg:self-auto"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300"/></span><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Analysis mode</div><div className="mt-0.5 text-sm font-medium text-slate-100">Contingency sandbox</div></div></div>
      </div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,.7fr)]">
      <Panel title="Transmission topology" eyebrow="Schematic · not a live SCADA diagram">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-300"/>Grid node</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-cyan-800"/>Healthy connection</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-rose-400"/>Selected outage</span></div>
        <div className="overflow-hidden rounded-xl border border-cyan-200/10 bg-[#050b16]"><IndiaGeoMap data={STATES} height={520}/></div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] p-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-300"/><div><div className="text-xs font-semibold text-rose-100">Selected contingency: {selected.name}</div><p className="mt-1 text-xs leading-5 text-slate-400">The map provides national geographic context. The selected outage is represented in the scenario controls; corridor-specific post-outage flows are not yet solved by a physical power-flow engine.</p></div></div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><Activity size={17} className="mt-0.5 shrink-0 text-cyan-300"/><p className="text-xs leading-5 text-slate-400">This is a schematic topology for explaining contingency logic. It is not a geographically accurate transmission map or a substitute for a validated AC power-flow solver.</p></div>
      </Panel>
      <div className="space-y-5">
        <Panel title="Simulate one component loss" eyebrow="Operator control">
          <label htmlFor="n1-component" className="mb-2 block text-xs font-medium text-slate-300">Component to remove from service</label>
          <div className="relative"><select id="n1-component" value={selectedId} onChange={(event) => {setSelectedId(event.target.value); setResult(false);}} className="w-full appearance-none rounded-xl border border-cyan-200/20 bg-slate-950 px-3 py-3 pr-10 text-sm text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15">{CONTINGENCIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/></div>
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Affected area</div><div className="mt-1 text-sm font-medium text-slate-200">{selected.affected}</div><div className="mt-1 text-xs text-slate-400">{selected.kind} · single-contingency case</div></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setResult(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_-12px_rgba(34,211,238,.8)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200"><Zap size={16}/> Run analysis</button><button type="button" onClick={() => {setSelectedId(CONTINGENCIES[0].id);setResult(false);}} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-200/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/40"><RotateCcw size={15}/> Reset</button></div>
        </Panel>
        <Panel title="Post-contingency estimate" eyebrow="Illustrative model output">
          {!result ? <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center"><Activity size={24} className="text-cyan-300/70"/><p className="mt-3 text-sm font-medium text-slate-200">Ready to evaluate</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Select a component and run the scenario to view its illustrative stress estimate.</p></div> : <div className="space-y-3 animate-fade-up"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-200">Estimated maximum loading</span><span className={"text-sm font-bold " + (estimatedLoading >= 90 ? "text-amber-200" : "text-emerald-300")}>{estimatedLoading.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={"h-full rounded-full transition-all duration-700 " + (estimatedLoading >= 90 ? "bg-amber-300" : "bg-gradient-to-r from-cyan-400 to-emerald-300")} style={{width: estimatedLoading + "%"}}/></div><div className="grid grid-cols-2 gap-3"><Metric label="Constraint flags" value={String(estimatedViolations)} tone={estimatedViolations ? "amber" : "green"}/><Metric label="Stress estimate" value={estimatedLoading >= 90 ? "Elevated" : "Moderate"} tone={estimatedLoading >= 90 ? "amber" : "cyan"}/></div><div className={"flex items-start gap-2 rounded-xl border p-3 text-sm " + (estimatedViolations ? "border-amber-300/20 bg-amber-300/[0.05] text-amber-100" : "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-100")}>{estimatedViolations ? <AlertTriangle size={17} className="mt-0.5 shrink-0"/> : <CheckCircle2 size={17} className="mt-0.5 shrink-0"/>}<div><div className="font-semibold">{status}</div><div className="mt-1 text-xs leading-5 opacity-80">Heuristic estimate for demonstration only. Validate with network topology, impedance, dispatch and a production-grade contingency solver before operational use.</div></div></div></div>}
        </Panel>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Study scope" value="N-1" /><Metric label="Contingencies available" value={String(CONTINGENCIES.length)} /><Metric label="Purpose" value="Resilience" tone="green"/></div>
    <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-r from-violet-400/[0.07] via-cyan-400/[0.04] to-transparent p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.08] p-2.5 text-violet-200"><Shield size={20}/></div><div><h3 className="text-base font-semibold text-slate-100">Why N-1 matters</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">Power grids are interconnected. When one line or other component fails, power attempts to flow through remaining paths. N-1 analysis asks whether those paths can carry the redistributed load without unacceptable overload, voltage problems or separation into disconnected islands. It helps planners find weak points and operators prioritise corrective action before a single failure escalates.</p></div></div></div>
  </div>;
}
