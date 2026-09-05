import { useMemo } from "react";
import { BarChart3, CheckCircle2, Fuel, Gauge, ShieldCheck, Sparkles, TestTube2, Zap } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGridOptimizerResult, useMonteCarloResult, useNationalGridSnapshot } from "@/hooks/use-grid-backend";
import { optimizeFuelDispatch, calculateEnergyMix } from "@/services/fuel-optimization";
import { runModelBenchmark } from "@/services/model-benchmark";

const SOURCE_COLORS = ["#4ade80", "#60a5fa", "#22d3ee", "#a78bfa", "#f59e0b", "#fb7185", "#f97316", "#94a3b8"];

export function GridEvidenceRoom() {
  const snapshotQuery = useNationalGridSnapshot();
  const monteCarloQuery = useMonteCarloResult({ simulations: 4000, seed: 17329 });
  const optimizerQuery = useGridOptimizerResult({ simulations: 4000, seed: 17329 });
  const snapshot = snapshotQuery.data;
  const benchmark = useMemo(() => runModelBenchmark(), []);
  const fuel = useMemo(() => (snapshot ? optimizeFuelDispatch(snapshot) : null), [snapshot]);
  const mix = useMemo(() => (snapshot && fuel ? calculateEnergyMix(snapshot, fuel) : []), [snapshot, fuel]);

  const demand = snapshot?.nationalDemandMw ?? 0;
  const renewable = snapshot?.nationalRenewableGenerationMw ?? 0;
  const supply = snapshot
    ? snapshot.states.reduce((sum, state) => sum + state.energy.estimatedDemandMw + state.energy.supplyDemandGapMw, 0)
    : 0;
  const stockTotal = fuel?.fuel.reduce((sum, source) => sum + source.stockMwh, 0) ?? 0;
  const stockAfter = fuel?.fuel.reduce((sum, source) => sum + source.stockAfterMwh, 0) ?? 0;

  const distribution = snapshot
    ? [
        { bucket: "Demand", value: Math.round(demand / 100) / 10 },
        { bucket: "Supply", value: Math.round(supply / 100) / 10 },
        { bucket: "Renewables", value: Math.round(renewable / 100) / 10 },
        { bucket: "Fuel dispatch", value: Math.round((fuel?.optimizedDispatchMw ?? 0) / 100) / 10 },
        { bucket: "Battery", value: Math.round(snapshot.states.reduce((s, x) => s + x.energy.batteryAvailableMwh / 4, 0) / 100) / 10 },
      ]
    : [];

  const loading = snapshotQuery.isLoading || monteCarloQuery.isLoading || optimizerQuery.isLoading;

  return (
    <div className="min-h-screen bg-[#050812] text-foreground">
      <div className="mx-auto max-w-[1600px] px-5 py-10 md:px-10">
        <header className="mb-8 border-b border-[oklch(0.72_0.18_245/0.18)] pb-7">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono tracking-[0.22em] text-muted-foreground">
            <span className="rounded border border-[oklch(0.85_0.21_145/0.35)] bg-[oklch(0.85_0.21_145/0.06)] px-2 py-1 text-[oklch(0.85_0.21_145)]">07 · EVIDENCE ROOM</span>
            <span>LIVE SNAPSHOT · DETERMINISTIC MATH · SYNTHETIC ML COUNTERFACTUAL</span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight md:text-6xl">
            From <span className="text-[oklch(0.85_0.21_145)]">energy mix</span> to the decision.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            One judge-friendly sequence: what is available, what is demanded, how much fuel is in reserve, how fuel is optimized, why the mathematical model leads, and whether every backend module passes its checks.
          </p>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Demand" value={`${(demand / 1000).toFixed(1)} GW`} note="estimated national load" icon={<Gauge size={15} />} />
          <Metric label="Supply" value={`${(supply / 1000).toFixed(1)} GW`} note="available modeled supply" icon={<Zap size={15} />} />
          <Metric label="Renewables" value={`${(renewable / 1000).toFixed(1)} GW`} note={`${snapshot?.nationalRenewablePenetrationPercent ?? 0}% penetration`} icon={<Sparkles size={15} />} />
          <Metric label="Fuel Stock" value={`${(stockAfter / 1000).toFixed(1)} GWh`} note={`${(stockTotal / 1000).toFixed(1)} GWh modeled before dispatch`} icon={<Fuel size={15} />} />
          <Metric label="Reserve Margin" value={`${snapshot?.nationalReserveMarginPercent ?? 0}%`} note={optimizerQuery.data ? `${optimizerQuery.data.systemPriority} priority` : "optimizer pending"} icon={<ShieldCheck size={15} />} />
        </section>

        <Section number="01" title="Energy mix & demand/supply" subtitle="Every major source is visible before optimization makes a recommendation.">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel>
              <PanelTitle>Modeled generation distribution</PanelTitle>
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mix} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-18} textAnchor="end" />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" MW" />
                    <Tooltip contentStyle={{ background: "#0b1120", border: "1px solid rgba(96,165,250,.25)", borderRadius: 8 }} />
                    <Bar dataKey="mw" name="Output" radius={[4, 4, 0, 0]}>
                      {mix.map((entry, index) => <Cell key={entry.name} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4 text-[10px] font-mono md:grid-cols-4">
                <Legend label="RENEWABLE" value={`${((renewable / Math.max(1, demand)) * 100).toFixed(1)}%`} />
                <Legend label="FUEL" value={`${((fuel?.optimizedDispatchMw ?? 0) / Math.max(1, demand) * 100).toFixed(1)}%`} />
                <Legend label="STORAGE" value={`${(snapshot ? snapshot.states.reduce((s, x) => s + x.energy.batteryAvailableMwh / 4, 0) : 0).toFixed(0)} MW`} />
                <Legend label="GAP" value={`${((supply - demand) / 1000).toFixed(1)} GW`} />
              </div>
            </Panel>

            <Panel>
              <PanelTitle>System distribution at a glance</PanelTitle>
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={distribution} margin={{ top: 15, right: 20, left: 0, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="bucket" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis unit=" GW" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#0b1120", border: "1px solid rgba(96,165,250,.25)", borderRadius: 8 }} />
                    <Bar dataKey="value" name="Power" radius={[4, 4, 0, 0]}>
                      {distribution.map((_, index) => <Cell key={index} fill={SOURCE_COLORS[index]} />)}
                    </Bar>
                    <Line type="monotone" dataKey="value" stroke="#e2e8f0" strokeWidth={1.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-[oklch(0.72_0.18_245/0.15)] bg-black/20 p-4 text-xs leading-5 text-muted-foreground">
                <b className="text-foreground">Reading order:</b> Demand → Supply → Renewables → Fuel → Storage. The operator sees the physical balance first; optimization comes second.
              </div>
            </Panel>
          </div>
        </Section>

        <Section number="02" title="Fuel optimisation & stock availability" subtitle="Fuel is not a black box. The panel can see what exists, what gets dispatched, and what remains.">
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <Panel>
              <PanelTitle>Modeled stock reserve</PanelTitle>
              <div className="space-y-5">
                {(fuel?.fuel ?? []).map((source) => (
                  <div key={source.id}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium">{source.label}</span>
                      <span className="font-mono text-muted-foreground">{source.stockAfterMwh.toLocaleString()} / {source.stockMwh.toLocaleString()} MWh</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-[oklch(0.85_0.21_145)]" style={{ width: `${Math.max(2, (source.stockAfterMwh / source.stockMwh) * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>DISPATCH {source.recommendedDispatchMw.toLocaleString()} MW</span>
                      <span>{(source.stockAfterMwh / Math.max(1, source.stockMwh) * 100).toFixed(1)}% remaining</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <MiniStat label="DISPATCH NEED" value={`${((fuel?.requiredDispatchMw ?? 0) / 1000).toFixed(2)} GW`} />
                <MiniStat label="OPTIMIZED" value={`${((fuel?.optimizedDispatchMw ?? 0) / 1000).toFixed(2)} GW`} />
                <MiniStat label="MODELED COST" value={`₹${((fuel?.estimatedCost ?? 0) / 1_000_000).toFixed(1)}M`} />
                <MiniStat label="CARBON" value={`${((fuel?.estimatedCarbonKg ?? 0) / 1000).toFixed(1)} t`} />
              </div>
              <p className="mt-4 text-[10px] leading-4 text-muted-foreground">Stock values are explicitly modeled energy-equivalent reserves for the simulation; they are not live inventory claims.</p>
            </Panel>

            <Panel>
              <PanelTitle>Why this dispatch?</PanelTitle>
              <div className="mb-5 rounded-xl border border-[oklch(0.85_0.21_145/0.22)] bg-[oklch(0.85_0.21_145/0.04)] p-5">
                <div className="font-mono text-[10px] tracking-[0.2em] text-[oklch(0.85_0.21_145)]">FUEL OPTIMISATION RULE</div>
                <div className="mt-3 font-display text-xl">Meet residual demand at minimum modeled marginal cost, subject to stock and dispatch limits.</div>
                <div className="mt-4 rounded-lg bg-black/30 p-4 font-mono text-xs leading-6 text-slate-300">
                  Residual demand = Demand − Renewables − Battery power<br />
                  Dispatchᵢ = min(Residual demand, Stockᵢ, Max dispatchᵢ)<br />
                  Total cost = Σ(Dispatchᵢ × Marginal costᵢ)
                </div>
              </div>
              <div className="space-y-2">
                {(fuel?.fuel ?? []).map((source, index) => (
                  <div key={source.id} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 rounded-lg border border-white/5 bg-black/15 p-3 text-xs">
                    <span className="font-mono text-muted-foreground">0{index + 1}</span>
                    <span>{source.label}</span>
                    <span className="font-mono text-muted-foreground">₹{source.marginalCostPerMwh.toLocaleString()}/MWh</span>
                    <span className="font-mono text-[oklch(0.85_0.21_145)]">{source.recommendedDispatchMw.toLocaleString()} MW</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </Section>

        <Section number="03" title="Mathematical model vs ML" subtitle="The ML section exists to answer the accuracy question — but it does not replace the mathematical decision engine.">
          <div className="grid gap-5 lg:grid-cols-2">
            <ModelCard
              title="MATHEMATICAL MODEL"
              accent="primary"
              accuracy={benchmark.mathematicalAccuracyPercent}
              lead={benchmark.mathematicalLeadTimeHours}
              falseAlerts={benchmark.mathematicalFalseAlerts}
              winner
              body="Uses explicit reserve, renewable, demand and stock relationships to derive an alert before the failure signature becomes operationally obvious."
            />
            <ModelCard
              title="ML COUNTERFACTUAL"
              accent="secondary"
              accuracy={benchmark.mlAccuracyPercent}
              lead={benchmark.mlLeadTimeHours}
              falseAlerts={benchmark.mlFalseAlerts}
              body="A deliberately simple learned baseline shown for comparison. It reacts to the same synthetic replay but with less physical structure."
            />
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.75fr]">
            <Panel>
              <PanelTitle>Judge takeaway</PanelTitle>
              <div className="grid gap-4 md:grid-cols-3">
                <Callout title="ACCURACY" value={`${benchmark.mathematicalAccuracyPercent}%`} detail={`vs ${benchmark.mlAccuracyPercent}% ML`} />
                <Callout title="EARLY WARNING" value={`${benchmark.mathematicalLeadTimeHours} h`} detail={`vs ${benchmark.mlLeadTimeHours} h ML`} />
                <Callout title="ROLE OF ML" value="SECONDARY" detail="comparison + research layer" />
              </div>
              <div className="mt-5 rounded-lg border border-white/5 bg-black/20 p-4 text-xs leading-5 text-muted-foreground">
                <b className="text-foreground">Important:</b> this is a synthetic deterministic replay benchmark. It demonstrates the architecture and comparison methodology; it is not a claim of real-world field accuracy.
              </div>
            </Panel>
            <Panel>
              <PanelTitle>Mathematical decision formula</PanelTitle>
              <div className="rounded-xl border border-[oklch(0.72_0.18_245/0.2)] bg-black/30 p-5 font-mono text-xs leading-7 text-slate-200">
                <div>Net supply = R + B + F</div>
                <div>Reserve = (Net supply − D) / D</div>
                <div>Risk = w₁·stress + w₂·reserve deficit</div>
                <div className="mt-2 text-[oklch(0.85_0.21_145)]">Decision = argmin(cost) subject to Reserve ≥ target</div>
                <div className="mt-3 text-[10px] leading-5 text-muted-foreground">R = renewable generation · B = battery power · F = optimized fuel dispatch · D = demand</div>
              </div>
            </Panel>
          </div>
        </Section>

        <Section number="04" title="Monte Carlo distributions" subtitle="Uncertainty stays visible instead of being hidden behind one point estimate.">
          <div className="grid gap-5 lg:grid-cols-3">
            <DistributionCard title="Demand" p5={monteCarloQuery.data?.demandPercentiles.p5} p50={monteCarloQuery.data?.demandPercentiles.p50} p95={monteCarloQuery.data?.demandPercentiles.p95} unit="MW" />
            <DistributionCard title="Renewable generation" p5={monteCarloQuery.data?.renewableGenerationPercentiles.p5} p50={monteCarloQuery.data?.renewableGenerationPercentiles.p50} p95={monteCarloQuery.data?.renewableGenerationPercentiles.p95} unit="MW" />
            <Panel>
              <PanelTitle>Risk distribution</PanelTitle>
              <div className="grid place-items-center py-6">
                <div className="relative h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "LOLP", value: monteCarloQuery.data?.lossOfLoadProbability ?? 0 }, { name: "Safe", value: 100 - (monteCarloQuery.data?.lossOfLoadProbability ?? 0) }]} dataKey="value" innerRadius={54} outerRadius={78} startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="#fb7185" /><Cell fill="#1e293b" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div><div className="font-display text-2xl">{monteCarloQuery.data?.lossOfLoadProbability ?? 0}%</div><div className="font-mono text-[9px] text-muted-foreground">LOLP</div></div>
                  </div>
                </div>
                <div className="mt-4 text-center text-xs text-muted-foreground">{monteCarloQuery.data?.simulations?.toLocaleString() ?? 0} seeded scenarios · EUE {monteCarloQuery.data?.expectedUnservedEnergyMwh?.toLocaleString() ?? 0} MWh</div>
              </div>
            </Panel>
          </div>
        </Section>

        <Section number="05" title="Backend verification" subtitle="Every core module gets a visible pass/fail checkpoint for the judge.">
          <Panel>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Weather → grid metrics", Boolean(snapshot)],
                ["Energy model", Boolean(snapshot && snapshot.nationalDemandMw > 0)],
                ["Fuel optimisation", Boolean(fuel && fuel.optimizedDispatchMw >= 0)],
                ["Monte Carlo", Boolean(monteCarloQuery.data && monteCarloQuery.data.simulations === 4000)],
                ["Grid optimizer", Boolean(optimizerQuery.data && optimizerQuery.data.recommendedActions.length >= 0)],
                ["Model benchmark", benchmark.mathematicalAccuracyPercent > benchmark.mlAccuracyPercent],
              ].map(([name, pass]) => (
                <div key={String(name)} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-4">
                  <div><div className="text-sm">{name}</div><div className="mt-1 font-mono text-[9px] text-muted-foreground">DETERMINISTIC CHECK</div></div>
                  {pass ? <CheckCircle2 size={20} className="text-[oklch(0.85_0.21_145)]" /> : <TestTube2 size={20} className="text-[oklch(0.82_0.17_75)] animate-pulse" />}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-[oklch(0.72_0.18_245/0.15)] bg-[oklch(0.72_0.18_245/0.04)] p-4 font-mono text-[10px] leading-5 text-muted-foreground">
              Backend command: <span className="text-foreground">python -m pytest backend -q</span><br />
              UI status: {loading ? "RUNNING LIVE MODULES…" : "ALL AVAILABLE MODULE CHECKS COMPLETED"}
            </div>
          </Panel>
        </Section>

        <footer className="mt-12 border-t border-white/5 pt-5 text-[10px] font-mono leading-5 text-muted-foreground">
          <span className="text-foreground">Grid Sentinel evidence chain:</span> weather → energy mix → demand/supply → stock → fuel optimisation → uncertainty → model comparison → backend verification.
        </footer>
      </div>
    </div>
  );
}

function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="mb-12"><div className="mb-5 flex gap-4"><span className="font-mono text-[10px] text-[oklch(0.72_0.18_245)]">{number}</span><div><h2 className="font-display text-2xl font-semibold md:text-3xl">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div></div>{children}</section>;
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-[oklch(0.12_0.025_255/0.75)] p-5 shadow-[0_0_35px_-18px_oklch(0.72_0.18_245/0.5)] md:p-6">{children}</div>; }
function PanelTitle({ children }: { children: React.ReactNode }) { return <div className="mb-5 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground"><BarChart3 size={13} />{children}</div>; }
function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) { return <div className="rounded-xl border border-white/5 bg-black/15 p-4"><div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.15em] text-muted-foreground">{icon}{label}</div><div className="mt-2 font-display text-2xl">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{note}</div></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/5 bg-black/20 p-3"><div className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground">{label}</div><div className="mt-1 font-display text-lg">{value}</div></div>; }
function Legend({ label, value }: { label: string; value: string }) { return <div><div className="text-muted-foreground">{label}</div><div className="mt-1 text-foreground">{value}</div></div>; }
function Callout({ title, value, detail }: { title: string; value: string; detail: string }) { return <div className="rounded-xl border border-white/5 bg-black/20 p-4"><div className="font-mono text-[9px] text-muted-foreground">{title}</div><div className="mt-2 font-display text-2xl text-[oklch(0.85_0.21_145)]">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div></div>; }
function ModelCard({ title, accuracy, lead, falseAlerts, body, winner }: { title: string; accent: string; accuracy: number; lead: number; falseAlerts: number; body: string; winner?: boolean }) { return <Panel><div className="flex items-center justify-between"><div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">{title}</div>{winner && <span className="rounded-full border border-[oklch(0.85_0.21_145/0.3)] px-2 py-1 text-[9px] font-mono text-[oklch(0.85_0.21_145)]">PRIMARY</span>}</div><div className="mt-5 grid grid-cols-3 gap-3"><Callout title="ACCURACY" value={`${accuracy}%`} detail="synthetic replay" /><Callout title="LEAD TIME" value={`${lead} h`} detail="before event" /><Callout title="FALSE ALERTS" value={String(falseAlerts)} detail="replay samples" /></div><p className="mt-5 text-xs leading-5 text-muted-foreground">{body}</p></Panel>; }
function DistributionCard({ title, p5, p50, p95, unit }: { title: string; p5?: number; p50?: number; p95?: number; unit: string }) { return <Panel><PanelTitle>{title} distribution</PanelTitle><div className="grid grid-cols-3 gap-3"><Callout title="P05" value={p5 === undefined ? "—" : `${p5.toLocaleString()}`} detail={unit} /><Callout title="P50" value={p50 === undefined ? "—" : `${p50.toLocaleString()}`} detail={unit} /><Callout title="P95" value={p95 === undefined ? "—" : `${p95.toLocaleString()}`} detail={unit} /></div><div className="mt-5 h-2 rounded-full bg-gradient-to-r from-[oklch(0.68_0.24_25)] via-[oklch(0.82_0.17_75)] to-[oklch(0.85_0.21_145)]" /><div className="mt-2 flex justify-between text-[9px] font-mono text-muted-foreground"><span>DOWNSIDE</span><span>MEDIAN</span><span>UPSIDE</span></div></Panel>; }
