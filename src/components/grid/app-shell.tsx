import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Globe2, FlaskConical, BrainCircuit, Snowflake } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Command Center", icon: Activity, code: "01" },
  { to: "/digital-twin", label: "Digital Twin", icon: Globe2, code: "02" },
  { to: "/simulation", label: "Crisis Lab", icon: FlaskConical, code: "03" },
  { to: "/texas-2021", label: "Texas 2021", icon: Snowflake, code: "04" },
  { to: "/control-room", label: "AI Control Room", icon: BrainCircuit, code: "05" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className={`sticky top-0 z-40 transition-all duration-700 ${
          isHome
            ? "bg-transparent border-b border-transparent"
            : "bg-[#070B14]/80 backdrop-blur-xl border-b border-[oklch(0.72_0.18_245/0.15)]"
        }`}
      >
        <div
          className={`px-6 py-3 flex items-center gap-6 ${isHome ? "max-w-[1600px] mx-auto" : ""}`}
        >
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-md bg-[oklch(0.72_0.18_245)]/20 border border-[oklch(0.72_0.18_245)]/60" />
              <div className="absolute inset-1 rounded-sm bg-[oklch(0.72_0.18_245)]/40 animate-flicker" />
              <div className="absolute inset-0 grid place-items-center font-display font-bold text-sm text-[oklch(0.85_0.21_145)]">
                G
              </div>
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-mono text-muted-foreground tracking-[0.25em]">
                GRID SENTINEL
              </div>
              <div className="font-display font-semibold text-sm">AI · NATIONAL OPERATIONS</div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 ml-4">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`group relative px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                    active
                      ? "text-foreground bg-[oklch(0.72_0.18_245/0.12)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-[oklch(0.72_0.18_245/0.06)]"
                  }`}
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{n.code}</span>
                  <n.icon size={15} />
                  {n.label}
                  {active && (
                    <span className="absolute -bottom-px left-2 right-2 h-px bg-[oklch(0.72_0.18_245)] shadow-[0_0_10px_oklch(0.72_0.18_245)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <StatusPill label="GRID FREQ" value="49.98 Hz" tone="accent" />
            <StatusPill label="POSOCO" value="LINK OK" tone="primary" />
            <StatusPill label="DR TIER" value="ARMED" tone="warning" />
            <div className="font-mono text-[11px] text-muted-foreground">
              <ClockUTC />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[oklch(0.72_0.18_245/0.12)] px-6 py-3 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
        <span>GRID SENTINEL AI · v7.3.1 · MODEL TS-49</span>
        <span>SIMULATION ENVIRONMENT · NOT FOR DISPATCH</span>
        <span>© Grid Sentinel · Predict. Simulate. Optimize. Prevent.</span>
      </footer>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "accent" | "warning";
}) {
  const colors = {
    primary: "oklch(0.72 0.18 245)",
    accent: "oklch(0.85 0.21 145)",
    warning: "oklch(0.82 0.17 75)",
  } as const;
  const c = colors[tone];
  return (
    <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded border border-[oklch(0.72_0.18_245/0.15)] bg-[oklch(0.16_0.028_260/0.6)]">
      <span
        className="w-1.5 h-1.5 rounded-full animate-flicker"
        style={{ background: c, boxShadow: `0 0 8px ${c}` }}
      />
      <span className="hud-label">{label}</span>
      <span className="text-[11px] font-mono" style={{ color: c }}>
        {value}
      </span>
    </div>
  );
}

function ClockUTC() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    setT(new Date().toUTCString().slice(17, 25));
    const i = setInterval(() => setT(new Date().toUTCString().slice(17, 25)), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{t} UTC</span>;
}
