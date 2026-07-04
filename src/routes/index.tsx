import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Cpu,
  CloudLightning,
  Activity,
  LineChart,
  FlaskConical,
  Sparkles,
  BrainCircuit,
  Zap,
} from "lucide-react";
import { IndiaMap } from "@/components/grid/india-map";
import { ReasoningChain } from "@/components/grid/reasoning-chain";
import { useReveal, useScrollProgress, useCountUp } from "@/lib/use-reveal";
import { STATES } from "@/lib/grid-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grid Sentinel AI · The Operating System for a Nation's Electricity" },
      {
        name: "description",
        content:
          "An AI-powered National Grid Digital Twin for India. Weather intelligence, demand forecasting, Monte Carlo simulation, and decision support — engineered to prevent blackouts before they occur.",
      },
      { property: "og:title", content: "Grid Sentinel AI" },
      { property: "og:description", content: "Predict. Simulate. Optimize. Prevent." },
    ],
  }),
  component: CinematicHome,
});

/* ─────────────────── Scroll utility ─────────────────── */
function useSectionProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when section just enters bottom, 1 when section's top reaches top
        const total = rect.height + vh;
        const passed = vh - rect.top;
        setP(Math.max(0, Math.min(1, passed / total)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, p };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const d = delay ? ` reveal-d${delay}` : "";
  return (
    <div ref={ref} className={`reveal${d} ${shown ? "is-in" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────── ROOT ─────────────────── */
function CinematicHome() {
  const progress = useScrollProgress();
  return (
    <div className="relative -mt-[60px]">
      {/* Top hairline progress */}
      <div
        className="fixed top-0 left-0 right-0 h-px z-50 origin-left"
        style={{
          transform: `scaleX(${progress})`,
          background: "linear-gradient(90deg, oklch(0.72 0.18 245), oklch(0.85 0.21 145))",
          boxShadow: "0 0 12px oklch(0.85 0.21 145 / 0.6)",
        }}
      />

      <SceneOne />
      <SceneTwo />
      <SceneThree />
      <SceneFour />
      <SceneFive />
      <SceneSix />
      <SceneSeven />
      <SceneEight />
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 1 — Dark genesis: particles + transmission lines  */
/* ──────────────────────────────────────────────────────── */
function SceneOne() {
  const { ref, p } = useSectionProgress<HTMLElement>();
  const [t, setT] = useState("--:--:-- IST");
  useEffect(() => {
    setT(formatIST(new Date()));
    const i = setInterval(() => setT(formatIST(new Date())), 1000);
    return () => clearInterval(i);
  }, []);

  // Pre-generate stable particles + lines
  const particles = useMemo(() => {
    const rand = seededRandom(11);
    return Array.from({ length: 80 }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 100,
      r: rand() * 1.2 + 0.2,
      d: 4 + rand() * 8,
      o: rand() * 0.7 + 0.15,
      delay: rand() * 6,
      key: i,
    }));
  }, []);
  const lines = useMemo(() => {
    const rand = seededRandom(29);
    return Array.from({ length: 14 }, (_, i) => ({
      x1: rand() * 100,
      y1: rand() * 100,
      x2: rand() * 100,
      y2: rand() * 100,
      delay: i * 0.18,
      key: i,
    }));
  }, []);

  // Scroll-driven reveal timing
  const heroP = p;
  const t1 = clamp((heroP - 0.05) / 0.18); // lines draw
  const t2 = clamp((heroP - 0.18) / 0.18); // headline
  const visibleT2 = 1;
  const t3 = clamp((heroP - 0.32) / 0.18); // sub words
  const fadeOut = 1 - clamp((p - 0.78) / 0.22);

  return (
    <section ref={ref} className="relative h-[180vh]">
      <div
        className="sticky top-0 h-screen w-full overflow-hidden grain"
        style={{ opacity: fadeOut }}
      >
        {/* Deep space */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_60%,oklch(0.18_0.05_255/0.6),#040710_70%)]" />
        <div className="absolute inset-0 grid-bg opacity-[0.18]" />

        {/* Particle field */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <radialGradient id="p1" cx="0.5" cy="0.5">
              <stop offset="0%" stopColor="oklch(0.92 0.06 200)" stopOpacity="1" />
              <stop offset="100%" stopColor="oklch(0.92 0.06 200)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="trans-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.72 0.18 245)" stopOpacity="0" />
              <stop offset="50%" stopColor="oklch(0.85 0.21 145)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="oklch(0.72 0.18 245)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {particles.map((pt) => (
            <circle
              key={pt.key}
              cx={pt.x}
              cy={pt.y}
              r={pt.r}
              fill="url(#p1)"
              opacity={pt.o * (0.4 + 0.6 * t1)}
            >
              <animate
                attributeName="opacity"
                values={`${pt.o};${pt.o * 0.2};${pt.o}`}
                dur={`${pt.d}s`}
                begin={`${pt.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}

          {/* Transmission lines (length-revealed via stroke-dashoffset based on scroll) */}
          {lines.map((l) => {
            const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
            const offset = len * (1 - t1);
            return (
              <g key={l.key}>
                <line
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="url(#trans-line)"
                  strokeWidth="0.12"
                  strokeDasharray={len}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Ambient bloom */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full bg-[oklch(0.72_0.18_245)]/12 blur-[140px]" />
        <div className="absolute bottom-[-220px] right-[5%] w-[700px] h-[500px] rounded-full bg-[oklch(0.85_0.21_145)]/8 blur-[140px]" />

        {/* Headline */}
        <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-12 max-w-[1600px] mx-auto">
          <div
            className="mb-10 flex items-center gap-3"
            style={{ opacity: t1, transform: `translateY(${(1 - t1) * 12}px)` }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
            <span className="hud-label">PROJECT SENTINEL · NATIONAL GRID DIGITAL TWIN · INDIA</span>
            <span className="hidden md:block flex-1 h-px bg-gradient-to-r from-[oklch(0.72_0.18_245/0.3)] to-transparent" />
            <span className="hidden md:block font-mono text-[10px] text-muted-foreground">{t}</span>
          </div>

          <h1
            className="display-xl font-display max-w-[16ch] leading-[0.95]"
            style={{ opacity: visibleT2, transform: `translateY(${(1 - visibleT2) * 20}px)` }}
          >
            GRID SENTINEL <span className="text-[oklch(0.72_0.18_245)] text-glow-primary">AI</span>
          </h1>

          <div
            className="mt-12 flex flex-wrap gap-x-12 gap-y-3 text-2xl md:text-3xl font-display font-light tracking-tight"
            style={{ opacity: t3, transform: `translateY(${(1 - t3) * 16}px)` }}
          >
            <Verb i={0} t={t3}>
              Predict.
            </Verb>
            <Verb i={1} t={t3}>
              Simulate.
            </Verb>
            <Verb i={2} t={t3}>
              Optimize.
            </Verb>
            <Verb i={3} t={t3} accent>
              Prevent.
            </Verb>
          </div>

          <div
            className="absolute left-6 md:left-12 right-6 md:right-12 bottom-10 flex items-end justify-between font-mono text-[10px] text-muted-foreground"
            style={{ opacity: t3 }}
          >
            <div className="flex items-center gap-3">
              <span>SCROLL TO ENTER</span>
              <span className="block w-10 h-px bg-[oklch(0.72_0.18_245)]" />
              <span className="w-1 h-1 rounded-full bg-[oklch(0.72_0.18_245)] animate-pulse" />
            </div>
            <div className="hidden md:flex gap-6">
              <span>20.5937° N · 78.9629° E</span>
              <span>FREQ 49.98 Hz</span>
              <span>POSOCO · NLDC LINK OK</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Verb({
  children,
  i,
  t,
  accent,
}: {
  children: ReactNode;
  i: number;
  t: number;
  accent?: boolean;
}) {
  const own = clamp((t - i * 0.12) * 2);
  return (
    <span
      style={{ opacity: own, transform: `translateY(${(1 - own) * 12}px)` }}
      className={`transition-opacity ${accent ? "text-[oklch(0.85_0.21_145)] text-glow-accent" : "text-foreground"}`}
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 2 — Camera moves toward India, states ignite      */
/* ──────────────────────────────────────────────────────── */
function SceneTwo() {
  const { ref, p } = useSectionProgress<HTMLElement>();
  // Camera zoom (scale + brightness)
  const zoom = 0.85 + 0.5 * easeOutCubic(clamp(p * 1.4));
  const ignite = clamp((p - 0.2) / 0.5); // how lit states become
  const captionIn = clamp((p - 0.35) / 0.25);
  const captionOut = 1 - clamp((p - 0.85) / 0.15);

  return (
    <section ref={ref} className="relative h-[220vh] bg-[#040710]">
      <div className="sticky top-0 h-screen w-full overflow-hidden grain">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_55%,oklch(0.72_0.18_245/0.18),transparent_70%)]" />

        {/* Cloud band moving slowly */}
        <div
          className="absolute inset-y-0 -left-1/3 w-[200%] opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 30% 18% at 30% 40%, oklch(0.82 0.05 245/0.15), transparent 60%), radial-gradient(ellipse 25% 14% at 70% 60%, oklch(0.82 0.05 245/0.12), transparent 60%)",
            transform: `translateX(${(p - 0.5) * 200}px)`,
            transition: "transform 200ms linear",
          }}
        />

        <div
          className="absolute inset-0 grid place-items-center"
          style={{ transform: `scale(${zoom})`, transition: "transform 200ms linear" }}
        >
          <div className="relative w-[min(92vw,1100px)] h-[min(82vh,820px)]">
            {/* Render the existing India map but cinematic-trimmed */}
            <div
              className="absolute inset-0"
              style={{
                filter: `brightness(${0.5 + ignite * 0.6}) saturate(${0.7 + ignite * 0.6})`,
              }}
            >
              <IndiaMap height={820} interactive={false} showLabels={false} />
            </div>

            {/* Glowing renewables sprinkles */}
            <svg
              viewBox="0 0 1000 900"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {STATES.filter((s) => s.renewable > 5).map((s, i) => (
                <g key={s.id} opacity={ignite}>
                  <circle cx={s.x} cy={s.y - 14} r="2" fill="oklch(0.85 0.21 145)">
                    <animate
                      attributeName="opacity"
                      values="0.3;1;0.3"
                      dur="3s"
                      begin={`${i * 0.2}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx={s.x + 16} cy={s.y - 4} r="1.5" fill="oklch(0.82 0.14 200)">
                    <animate
                      attributeName="opacity"
                      values="0.2;0.9;0.2"
                      dur="3.6s"
                      begin={`${i * 0.25}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Caption */}
        <div
          className="absolute left-0 right-0 bottom-[12vh] px-6 md:px-12 max-w-[1600px] mx-auto pointer-events-none"
          style={{
            opacity: Math.min(captionIn, captionOut),
            transform: `translateY(${(1 - captionIn) * 14}px)`,
          }}
        >
          <div className="hud-label mb-4">02 · A LIVING NETWORK</div>
          <h2 className="display-md font-display max-w-[26ch]">
            Twenty-eight states. Eleven thousand substations.{" "}
            <span className="text-muted-foreground">
              One continuous national surface — illuminated in real time.
            </span>
          </h2>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 3 — Intelligence pipeline                          */
/* ──────────────────────────────────────────────────────── */
const PIPELINE = [
  {
    code: "01",
    title: "Weather",
    body: "ECMWF + IMD ensembles · 4 km resolution",
    icon: CloudLightning,
  },
  { code: "02", title: "Demand", body: "State-level load · transformer forecast", icon: Activity },
  { code: "03", title: "Forecast", body: "Renewable generation envelope · 48 h", icon: LineChart },
  {
    code: "04",
    title: "Monte Carlo",
    body: "10,000 stochastic dispatch trajectories",
    icon: FlaskConical,
  },
  {
    code: "05",
    title: "Optimization",
    body: "Co-optimized for reliability · cost · carbon",
    icon: Sparkles,
  },
  {
    code: "06",
    title: "Decision Engine",
    body: "Ranked actions with confidence bounds",
    icon: BrainCircuit,
  },
  {
    code: "07",
    title: "Recommendation",
    body: "One dispatch instruction · authority retained",
    icon: Zap,
  },
];

function SceneThree() {
  const { ref, p } = useSectionProgress<HTMLElement>();
  // The pipeline reveals row by row as we scroll
  const activeF = clamp((p - 0.12) / 0.65) * PIPELINE.length;

  return (
    <section ref={ref} className="relative h-[240vh] bg-[#050810]">
      <div className="sticky top-0 h-screen w-full overflow-hidden grain">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_15%_50%,oklch(0.72_0.18_245/0.10),transparent_60%)]" />

        <div className="relative h-full max-w-[1600px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
          {/* Left: caption */}
          <div>
            <div className="hud-label mb-6">03 · INTELLIGENCE</div>
            <h2 className="display-lg font-display max-w-[20ch]">
              Information{" "}
              <span className="text-[oklch(0.72_0.18_245)] text-glow-primary">flows</span> through
              the AI.
            </h2>
            <p className="mt-8 text-lg text-muted-foreground max-w-md leading-relaxed">
              Seven layers. One continuous decision loop. Each layer narrows uncertainty until a
              single prescriptive action remains.
            </p>
          </div>

          {/* Right: vertical pipeline */}
          <div className="relative pl-10">
            {/* spine */}
            <div className="absolute left-3 top-0 bottom-0 w-px bg-[oklch(0.72_0.18_245/0.18)]" />
            <div
              className="absolute left-3 top-0 w-px bg-gradient-to-b from-[oklch(0.72_0.18_245)] via-[oklch(0.82_0.14_200)] to-[oklch(0.85_0.21_145)]"
              style={{
                height: `${Math.min(100, (activeF / PIPELINE.length) * 100)}%`,
                boxShadow: "0 0 12px oklch(0.72 0.18 245 / 0.7)",
                transition: "height 250ms linear",
              }}
            />

            <div className="space-y-6">
              {PIPELINE.map((it, i) => {
                const own = clamp(activeF - i);
                return (
                  <div
                    key={it.code}
                    className="relative flex items-start gap-6"
                    style={{
                      opacity: 0.25 + 0.75 * own,
                      transform: `translateX(${(1 - own) * 14}px)`,
                      transition: "opacity 350ms, transform 350ms",
                    }}
                  >
                    <div
                      className="absolute -left-[34px] top-3 w-3 h-3 rounded-full"
                      style={{
                        background: own > 0.4 ? "oklch(0.85 0.21 145)" : "oklch(0.3 0.03 255)",
                        boxShadow: own > 0.4 ? "0 0 14px oklch(0.85 0.21 145 / 0.8)" : "none",
                        transition: "all 300ms",
                      }}
                    />
                    <div className="shrink-0 mt-1">
                      <it.icon
                        size={20}
                        className={
                          own > 0.4 ? "text-[oklch(0.85_0.21_145)]" : "text-muted-foreground"
                        }
                      />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {it.code}
                        </span>
                        <h3 className="text-xl md:text-2xl font-display">{it.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 4 — Command Center emerges                         */
/* ──────────────────────────────────────────────────────── */
function SceneFour() {
  const { ref, p } = useSectionProgress<HTMLElement>();
  const { ref: rev, shown } = useReveal<HTMLDivElement>(0.3);
  const load = useCountUp(243, shown, 1800);
  const risk = useCountUp(62, shown, 2200);
  const stab = useCountUp(99.42, shown, 2200);

  const emerge = clamp((p - 0.15) / 0.45);

  return (
    <section ref={ref} className="relative min-h-[140vh] py-44 px-6 md:px-12 grain overflow-hidden">
      <div ref={rev} className="max-w-[1600px] mx-auto">
        <Reveal>
          <div className="hud-label mb-8">04 · COMMAND CENTER</div>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="display-lg font-display max-w-[20ch]">
            The control surface,{" "}
            <span className="text-muted-foreground italic font-normal">unhurried</span>.
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <p className="mt-8 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Only what an operator needs to act — at the size an executive needs to read.
          </p>
        </Reveal>

        <div
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-px bg-[oklch(0.72_0.18_245/0.15)] border border-[oklch(0.72_0.18_245/0.15)]"
          style={{
            opacity: 0.2 + 0.8 * emerge,
            transform: `translateY(${(1 - emerge) * 30}px)`,
            transition: "opacity 400ms, transform 600ms",
          }}
        >
          <ExecStat
            label="National load"
            value={`${Math.round(load)} GW`}
            sub="Live envelope · all-India"
            tone="accent"
          />
          <ExecStat
            label="Composite risk"
            value={`${Math.round(risk)}`}
            sub="Sentinel-TS · v7.3"
            tone="warning"
          />
          <ExecStat
            label="Predicted stability · 6h"
            value={`${stab.toFixed(2)}%`}
            sub="Confidence interval 95%"
            tone="primary"
          />
        </div>

        <div
          className="mt-16 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-px bg-[oklch(0.72_0.18_245/0.15)] border border-[oklch(0.72_0.18_245/0.15)]"
          style={{
            opacity: emerge,
            transform: `translateY(${(1 - emerge) * 30}px)`,
            transition: "opacity 500ms, transform 700ms",
          }}
        >
          <RiskTimeline />
          <ActionsList />
        </div>
      </div>
    </section>
  );
}

function ExecStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "primary" | "warning";
}) {
  const c =
    tone === "accent"
      ? "oklch(0.85 0.21 145)"
      : tone === "primary"
        ? "oklch(0.72 0.18 245)"
        : "oklch(0.82 0.17 75)";
  return (
    <div className="bg-[#070B14] p-10">
      <div className="hud-label">{label}</div>
      <div
        className="mt-4 display-md font-display tabular-nums"
        style={{ color: c, textShadow: `0 0 30px ${c}55` }}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground font-mono">{sub}</div>
    </div>
  );
}

function RiskTimeline() {
  const points = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const x = i / 47;
        const base = 35 + Math.sin(i * 0.4) * 12 + Math.sin(i * 0.13) * 8;
        const surge = i > 28 && i < 40 ? (1 - Math.abs(i - 34) / 6) * 28 : 0;
        return { x, y: Math.max(10, Math.min(90, base + surge)) };
      }),
    [],
  );
  const path = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x * 100},${100 - pt.y}`).join(" ");
  const area = `${path} L100,100 L0,100 Z`;

  return (
    <div className="bg-[#070B14] p-8 md:p-10">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="hud-label">Risk evolution · next 48 h</div>
          <div className="mt-2 text-lg font-display">
            Watch window opens at <span className="text-[oklch(0.82_0.17_75)]">T+14h</span>
          </div>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">SENTINEL · FORECAST</div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-8 w-full h-56">
        <defs>
          <linearGradient id="risk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.17 75 / 0.45)" />
            <stop offset="100%" stopColor="oklch(0.82 0.17 75 / 0)" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map((g) => (
          <line
            key={g}
            x1="0"
            x2="100"
            y1={g}
            y2={g}
            stroke="oklch(0.72 0.18 245 / 0.08)"
            strokeWidth="0.2"
          />
        ))}
        <path d={area} fill="url(#risk-fill)" />
        <path d={path} fill="none" stroke="oklch(0.82 0.17 75)" strokeWidth="0.6" />
        {/* highlight surge */}
        <circle cx="71" cy={100 - points[34].y} r="1.4" fill="oklch(0.68 0.24 25)">
          <animate attributeName="r" values="1.4;3;1.4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>NOW</span>
        <span>+12h</span>
        <span>+24h</span>
        <span>+36h</span>
        <span>+48h</span>
      </div>
    </div>
  );
}

function ActionsList() {
  const items = [
    { t: "Pre-dispatch 1.2 GW BESS · Maharashtra cluster", g: "+0.41% reliability" },
    { t: "Arm DR tier 2 · Delhi feeders", g: "−620 MW peak shave" },
    { t: "Schedule import 800 MW · NR → WR", g: "Cost +₹1.4 Cr · risk −18%" },
    { t: "Curtail solar 14:00 IST · Rajasthan", g: "Avoids 240 MW overgen" },
  ];
  return (
    <div className="bg-[#070B14] p-8 md:p-10">
      <div className="hud-label mb-6">Ranked actions · last solve 18 ms</div>
      <ul className="space-y-5">
        {items.map((it, i) => (
          <li
            key={i}
            className="border-t border-[oklch(0.72_0.18_245/0.12)] pt-4 flex items-start gap-4"
          >
            <span className="font-mono text-xs text-[oklch(0.72_0.18_245)] mt-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1">
              <div className="text-sm font-display">{it.t}</div>
              <div className="mt-1 text-[11px] font-mono text-[oklch(0.85_0.21_145)]">{it.g}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 5 — Digital Twin (large map)                       */
/* ──────────────────────────────────────────────────────── */
function SceneFive() {
  return (
    <section className="relative min-h-screen py-32 px-6 md:px-12 grain overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full bg-[oklch(0.72_0.18_245)]/8 blur-[140px]" />
      </div>
      <div className="relative max-w-[1700px] mx-auto">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-6">
          <div>
            <Reveal>
              <div className="hud-label mb-4">05 · INDIA DIGITAL TWIN</div>
            </Reveal>
            <Reveal delay={1}>
              <h2 className="display-lg font-display max-w-[22ch]">
                Every state. Every megawatt.{" "}
                <span className="text-[oklch(0.82_0.14_200)]">Hover to inspect.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={2}>
            <Link
              to="/digital-twin"
              className="inline-flex items-center gap-2 text-sm text-[oklch(0.85_0.21_145)] hover:gap-3 transition-all"
            >
              Open the twin <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={2}>
          <div className="panel p-3">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(0.72_0.18_245/0.12)]">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  LIVE · NATIONAL SURFACE · 49.98 Hz · {STATES.length} BALANCING AREAS
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                SIM TIME · T+00:00:00
              </div>
            </div>
            <IndiaMap height={780} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 6 — Monte Carlo: probability cloud                 */
/* ──────────────────────────────────────────────────────── */
function SceneSix() {
  const { ref, p } = useSectionProgress<HTMLElement>();
  // Generate 600 deterministic samples — normal-ish blackout probability distribution
  const samples = useMemo(() => {
    const rand = seededRandom(61);
    const arr: { x: number; y: number; band: number; delay: number }[] = [];
    for (let i = 0; i < 600; i++) {
      // x = scenario index (0..1), y = predicted load / risk
      const x = i / 599;
      // Gaussian-ish around a curve
      const center = 50 + Math.sin(x * Math.PI) * 18;
      const noise = (rand() + rand() + rand() - 1.5) * 14;
      const y = center + noise;
      const band = Math.abs(noise) < 6 ? 0 : Math.abs(noise) < 12 ? 1 : 2;
      arr.push({
        x: round4(x * 100),
        y: round4(Math.max(8, Math.min(92, y))),
        band,
        delay: round4(rand() * 4),
      });
    }
    return arr;
  }, []);
  const reveal = clamp((p - 0.1) / 0.6);

  return (
    <section
      ref={ref}
      className="relative min-h-[160vh] py-32 px-6 md:px-12 grain overflow-hidden bg-[#050810]"
    >
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-16 items-center">
        <div>
          <Reveal>
            <div className="hud-label mb-6">06 · MONTE CARLO ENGINE</div>
          </Reveal>
          <Reveal delay={1}>
            <h2 className="display-lg font-display">
              Ten thousand{" "}
              <span className="italic font-normal text-muted-foreground">possible tomorrows</span> —
              every second.
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-8 text-lg text-muted-foreground max-w-md leading-relaxed">
              Sentinel does not predict <em className="text-foreground not-italic">a</em> future. It
              samples thousands — and dispatches against the worst 1%.
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-10 space-y-2 font-mono text-[11px] text-muted-foreground">
              <Bar label="P50 · expected load" v={62} c="oklch(0.72 0.18 245)" />
              <Bar label="P90 · stress envelope" v={78} c="oklch(0.82 0.17 75)" />
              <Bar label="P99 · tail risk" v={94} c="oklch(0.68 0.24 25)" />
            </div>
          </Reveal>
        </div>

        <Reveal delay={2}>
          <div className="panel p-5 relative">
            <div className="flex items-center justify-between mb-3 font-mono text-[10px]">
              <span className="text-muted-foreground">
                SCENARIO CLOUD · 10,240 SAMPLES · NEXT 6 H
              </span>
              <span className="text-[oklch(0.85_0.21_145)]">CONVERGED · σ 4.2%</span>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-[460px]">
              <defs>
                <linearGradient id="mc-p50" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 245/0.4)" />
                  <stop offset="100%" stopColor="oklch(0.85 0.21 145/0.4)" />
                </linearGradient>
              </defs>
              {/* confidence bands */}
              <rect x="0" y="38" width="100" height="24" fill="oklch(0.72 0.18 245/0.05)" />
              <rect x="0" y="28" width="100" height="44" fill="oklch(0.82 0.17 75/0.04)" />
              {/* p50 curve */}
              <path
                d={Array.from({ length: 30 }, (_, i) => {
                  const x = (i / 29) * 100;
                  const y = 50 - Math.sin((i / 29) * Math.PI) * 18;
                  return `${i === 0 ? "M" : "L"}${x},${y}`;
                }).join(" ")}
                stroke="url(#mc-p50)"
                strokeWidth="0.6"
                fill="none"
                strokeDasharray="100"
                strokeDashoffset={100 - reveal * 100}
              />
              {/* samples */}
              {samples.map((s, i) => {
                const color =
                  s.band === 0
                    ? "oklch(0.85 0.21 145)"
                    : s.band === 1
                      ? "oklch(0.82 0.17 75)"
                      : "oklch(0.68 0.24 25)";
                const op = (s.band === 0 ? 0.55 : s.band === 1 ? 0.35 : 0.55) * reveal;
                return (
                  <circle
                    key={i}
                    cx={s.x}
                    cy={s.y}
                    r={s.band === 2 ? 0.5 : 0.35}
                    fill={color}
                    opacity={op}
                  >
                    {i % 6 === 0 && (
                      <animate
                        attributeName="opacity"
                        values={`${op};${op * 0.2};${op}`}
                        dur="3.6s"
                        begin={`${s.delay}s`}
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                );
              })}
            </svg>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>NOW</span>
              <span>+1h</span>
              <span>+2h</span>
              <span>+3h</span>
              <span>+4h</span>
              <span>+5h</span>
              <span>+6h</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Bar({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span style={{ color: c }}>{v}%</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-[oklch(0.3_0.03_255/0.6)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: c, boxShadow: `0 0 12px ${c}` }}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 7 — Energy flow diagram                            */
/* ──────────────────────────────────────────────────────── */
function SceneSeven() {
  const sources = [
    { label: "Solar", pct: 32, color: "oklch(0.85 0.21 145)" },
    { label: "Wind", pct: 24, color: "oklch(0.82 0.14 200)" },
    { label: "Hydro", pct: 10, color: "oklch(0.75 0.14 220)" },
    { label: "Battery", pct: 14, color: "oklch(0.72 0.18 245)" },
    { label: "Gas", pct: 12, color: "oklch(0.82 0.17 75)" },
    { label: "Imports", pct: 8, color: "oklch(0.55 0.04 260)" },
  ];

  return (
    <section className="relative min-h-screen py-32 px-6 md:px-12 grain overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 right-0 w-[600px] h-[500px] rounded-full bg-[oklch(0.85_0.21_145)]/8 blur-[140px]" />
      </div>
      <div className="relative max-w-[1500px] mx-auto">
        <Reveal>
          <div className="hud-label mb-6">07 · GRID OPTIMIZATION</div>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="display-lg font-display max-w-[22ch]">
            Energy <span className="text-[oklch(0.85_0.21_145)] text-glow-accent">flows</span>{" "}
            through the network — co-optimized.
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <p className="mt-8 text-lg text-muted-foreground max-w-2xl">
            Six sources. One demand surface. Solved jointly for reliability, cost and carbon — every
            dispatch tick.
          </p>
        </Reveal>

        <Reveal delay={2} className="mt-20">
          <div className="panel p-8 md:p-12 relative overflow-hidden">
            <svg viewBox="0 0 1000 420" className="w-full h-[420px]">
              <defs>
                {sources.map((s) => (
                  <linearGradient key={s.label} id={`flow-${s.label}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.05" />
                    <stop offset="60%" stopColor={s.color} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.9" />
                  </linearGradient>
                ))}
              </defs>

              {/* Demand surface (right) */}
              <rect
                x="820"
                y="40"
                width="14"
                height="340"
                rx="2"
                fill="oklch(0.85 0.21 145 / 0.18)"
                stroke="oklch(0.85 0.21 145 / 0.6)"
              />
              <text
                x="848"
                y="60"
                fill="oklch(0.85 0.21 145)"
                fontFamily="JetBrains Mono, monospace"
                fontSize="11"
              >
                DEMAND
              </text>
              <text
                x="848"
                y="76"
                fill="oklch(0.86 0.02 250)"
                fontFamily="Space Grotesk"
                fontSize="22"
                fontWeight="600"
              >
                243 GW
              </text>

              {/* Flows from each source */}
              {(() => {
                let yAcc = 40;
                return sources.map((s, i) => {
                  const h = (s.pct / 100) * 340;
                  const srcY = 60 + i * 56;
                  const dstY = yAcc + h / 2;
                  yAcc += h;
                  const d = `M 160 ${srcY} C 460 ${srcY}, 560 ${dstY}, 820 ${dstY}`;
                  return (
                    <g key={s.label}>
                      {/* source label */}
                      <text
                        x="20"
                        y={srcY - 4}
                        fill="oklch(0.86 0.02 250)"
                        fontFamily="Space Grotesk"
                        fontSize="16"
                        fontWeight="500"
                      >
                        {s.label}
                      </text>
                      <text
                        x="20"
                        y={srcY + 14}
                        fill="oklch(0.68 0.025 250)"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize="11"
                      >
                        {s.pct}% · {Math.round((243 * s.pct) / 100)} GW
                      </text>
                      <rect
                        x="146"
                        y={srcY - 14}
                        width="10"
                        height="28"
                        rx="2"
                        fill={s.color}
                        opacity="0.85"
                      />
                      {/* curve */}
                      <path
                        d={d}
                        stroke={`url(#flow-${s.label})`}
                        strokeWidth={Math.max(3, h * 0.5)}
                        fill="none"
                        opacity="0.7"
                      />
                      {/* moving photon */}
                      <circle r="2.4" fill={s.color}>
                        <animateMotion dur={`${4 + i * 0.6}s`} repeatCount="indefinite" path={d} />
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          dur={`${4 + i * 0.6}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle r="1.4" fill="oklch(1 0 0)">
                        <animateMotion
                          dur={`${4 + i * 0.6}s`}
                          begin={`${i * 0.4}s`}
                          repeatCount="indefinite"
                          path={d}
                        />
                      </circle>
                    </g>
                  );
                });
              })()}
            </svg>

            <div className="mt-6 grid grid-cols-3 gap-px bg-[oklch(0.72_0.18_245/0.15)] border border-[oklch(0.72_0.18_245/0.15)]">
              <Outcome label="Expected reliability" v="99.42%" c="oklch(0.85 0.21 145)" />
              <Outcome label="Cost reduction" v="12.6%" c="oklch(0.72 0.18 245)" />
              <Outcome label="Carbon reduction" v="18.2%" c="oklch(0.82 0.14 200)" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Outcome({ label, v, c }: { label: string; v: string; c: string }) {
  return (
    <div className="bg-[#070B14] p-6">
      <div className="hud-label">{label}</div>
      <div
        className="mt-3 text-2xl font-display tabular-nums"
        style={{ color: c, textShadow: `0 0 20px ${c}55` }}
      >
        {v}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* SCENE 8 — Mission Control & closing                      */
/* ──────────────────────────────────────────────────────── */
function SceneEight() {
  const alerts = [
    {
      t: "14:02:11",
      l: "CRITICAL",
      c: "oklch(0.68 0.24 25)",
      title: "Maharashtra · demand surge +2.8 GW above forecast",
    },
    {
      t: "14:01:48",
      l: "WARNING",
      c: "oklch(0.82 0.17 75)",
      title: "Gujarat · wind generation declining −1.4 GW / 20 min",
    },
    {
      t: "14:00:33",
      l: "CRITICAL",
      c: "oklch(0.68 0.24 25)",
      title: "Delhi · frequency 49.78 Hz · DR tier 2 armed",
    },
    {
      t: "13:58:09",
      l: "WARNING",
      c: "oklch(0.82 0.17 75)",
      title: "Rajasthan · cloud band advancing SW→NE · solar −620 MW",
    },
    {
      t: "13:55:21",
      l: "INFO",
      c: "oklch(0.82 0.14 200)",
      title: "Karnataka · Pavagada BESS discharging 420 MW",
    },
    {
      t: "13:52:02",
      l: "OK",
      c: "oklch(0.85 0.21 145)",
      title: "Tamil Nadu · Muppandal wind +680 MW over baseline",
    },
  ];

  return (
    <section className="relative min-h-[140vh] py-32 px-6 md:px-12 grain overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1200px] h-[1000px] rounded-full bg-[oklch(0.72_0.18_245)]/10 blur-[160px]" />
        <div className="absolute inset-0 grid-bg opacity-20" />
      </div>

      <div className="relative max-w-[1600px] mx-auto">
        <Reveal>
          <div className="hud-label mb-6">08 · MISSION CONTROL</div>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="display-lg font-display max-w-[22ch]">
            Operating{" "}
            <span className="text-[oklch(0.72_0.18_245)] text-glow-primary">
              critical infrastructure
            </span>{" "}
            — with the calm of software.
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-[oklch(0.72_0.18_245/0.15)] border border-[oklch(0.72_0.18_245/0.15)]">
          <div className="bg-[#070B14] p-8 md:p-10">
            <div className="flex items-center justify-between mb-6">
              <div className="hud-label">Live alert stream</div>
              <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
                STREAMING
              </span>
            </div>
            <ul className="divide-y divide-[oklch(0.72_0.18_245/0.1)]">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-4 py-4">
                  <span className="font-mono text-[10px] text-muted-foreground w-16 mt-1">
                    {a.t}
                  </span>
                  <span
                    className="font-mono text-[10px] px-2 py-0.5 rounded border w-20 text-center"
                    style={{ color: a.c, borderColor: a.c + "55" }}
                  >
                    {a.l}
                  </span>
                  <div className="text-sm font-display flex-1">{a.title}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#070B14] p-8 md:p-10">
            <ReasoningChain
              title="AI reasoning · why this action"
              meta="SENTINEL · SOLVE 18 ms"
              steps={[
                {
                  signal: "Mumbai cluster demand rising",
                  detail: "+2.8 GW vs forecast",
                  trend: "up",
                },
                {
                  signal: "Western wind generation declining",
                  detail: "−1.4 GW / 20 min",
                  trend: "down",
                },
                {
                  signal: "Operating reserve margin shrinking",
                  detail: "8.2% → 4.1%",
                  trend: "down",
                },
                {
                  signal: "Pre-dispatch BESS · MH cluster",
                  detail: "+1.2 GW @ 17:40 IST",
                  trend: "action",
                },
                {
                  signal: "Blackout probability collapses",
                  detail: "21% → 3.2%",
                  trend: "resolved",
                },
              ]}
              conclusion={
                <>
                  <div className="text-lg md:text-xl font-display leading-snug">
                    Pre-dispatch <span className="text-[oklch(0.85_0.21_145)]">1.2 GW BESS</span>{" "}
                    across Maharashtra cluster before{" "}
                    <span className="text-[oklch(0.82_0.14_200)]">17:40 IST</span>.
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Marginal cost +₹1.4 Cr. Operator retains authority.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/control-room"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[oklch(0.85_0.21_145)] text-[#070B14] font-medium hover:gap-3 transition-all"
                    >
                      <Cpu size={14} /> Talk to Sentinel
                    </Link>
                    <Link
                      to="/simulation"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[oklch(0.72_0.18_245/0.3)] hover:bg-[oklch(0.72_0.18_245/0.08)] transition-colors"
                    >
                      Run crisis simulation →
                    </Link>
                  </div>
                </>
              }
            />
          </div>
        </div>

        {/* Closing */}
        <div className="mt-40 text-center">
          <Reveal>
            <div className="hud-label mb-10 flex items-center justify-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
              COMMIT WINDOW · OPEN
            </div>
          </Reveal>
          <Reveal delay={1}>
            <h2 className="display-xl font-display max-w-[14ch] mx-auto">
              Predict. Simulate.{" "}
              <span className="text-[oklch(0.72_0.18_245)] text-glow-primary">Optimize.</span>{" "}
              <span className="text-[oklch(0.85_0.21_145)] text-glow-accent">Prevent.</span>
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-10 text-lg text-muted-foreground max-w-2xl mx-auto">
              The grid never sleeps. Neither does Sentinel.
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-14 flex flex-wrap justify-center gap-4">
              <Link
                to="/digital-twin"
                className="group inline-flex items-center gap-3 pl-6 pr-3 py-3 rounded-full bg-[oklch(0.85_0.21_145)] text-[#070B14] font-medium hover:gap-4 transition-all"
              >
                Enter mission control
                <span className="grid place-items-center w-8 h-8 rounded-full bg-[#070B14] text-[oklch(0.85_0.21_145)]">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={4}>
            <div className="mt-32 pt-10 border-t border-[oklch(0.72_0.18_245/0.15)] flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-[10px] text-muted-foreground">
              <span>BUILT FOR · POSOCO · NLDC · SLDCs</span>
              <span className="hidden md:inline">·</span>
              <span>COMPLIANT · CEA · CERC</span>
              <span className="hidden md:inline">·</span>
              <span>DATA · 10⁹ POINTS / DAY</span>
              <span className="hidden md:inline">·</span>
              <span className="inline-flex items-center gap-2">
                <Zap size={11} className="text-[oklch(0.85_0.21_145)]" /> SENTINEL · ALWAYS ON
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── helpers ─────────────────── */
function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function formatIST(d: Date) {
  return (
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Kolkata",
      hour12: false,
    }) + " IST"
  );
}
