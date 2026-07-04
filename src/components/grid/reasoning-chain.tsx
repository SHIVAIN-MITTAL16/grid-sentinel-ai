import { type ReactNode } from "react";

export type ReasoningStep = {
  /** Short noun phrase — what was observed/inferred */
  signal: string;
  /** Quantitative detail */
  detail: string;
  /** Direction of pressure on the grid */
  trend: "up" | "down" | "stable" | "action" | "resolved";
};

interface Props {
  title?: string;
  steps: ReasoningStep[];
  /** Optional final recommendation block */
  conclusion?: ReactNode;
  /** Solve time / source */
  meta?: string;
  className?: string;
}

const TREND = {
  up: { c: "oklch(0.68 0.24 25)", glyph: "↑", word: "increasing" },
  down: { c: "oklch(0.82 0.17 75)", glyph: "↓", word: "decreasing" },
  stable: { c: "oklch(0.82 0.14 200)", glyph: "→", word: "stable" },
  action: { c: "oklch(0.72 0.18 245)", glyph: "◆", word: "action" },
  resolved: { c: "oklch(0.85 0.21 145)", glyph: "✓", word: "resolved" },
} as const;

/**
 * ReasoningChain — exposes Sentinel's engineering logic step by step.
 * Designed for trust: operators see *why* the AI recommended what it did.
 */
export function ReasoningChain({
  title = "AI reasoning chain",
  steps,
  conclusion,
  meta,
  className = "",
}: Props) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-5">
        <div className="hud-label">{title}</div>
        {meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}
      </div>

      <ol className="relative">
        {steps.map((s, i) => {
          const t = TREND[s.trend];
          const isLast = i === steps.length - 1;
          return (
            <li key={i} className="relative pl-10 pb-5 last:pb-0">
              {/* connector line */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 bottom-0 w-px"
                  style={{
                    background: `linear-gradient(180deg, ${t.c}88, oklch(0.72 0.18 245 / 0.15))`,
                  }}
                />
              )}
              {/* glyph */}
              <span
                aria-hidden
                className="absolute left-0 top-0 grid place-items-center w-[22px] h-[22px] rounded-full font-mono text-[11px] tabular-nums"
                style={{
                  color: t.c,
                  background: "#070B14",
                  border: `1px solid ${t.c}66`,
                  boxShadow: `0 0 12px ${t.c}55`,
                }}
              >
                {t.glyph}
              </span>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-sm md:text-[15px] font-display leading-snug">{s.signal}</div>
                <div
                  className="font-mono text-[10px] tabular-nums whitespace-nowrap"
                  style={{ color: t.c }}
                >
                  {s.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {conclusion && (
        <div className="mt-6 pt-5 border-t border-[oklch(0.72_0.18_245/0.15)]">{conclusion}</div>
      )}
    </div>
  );
}
