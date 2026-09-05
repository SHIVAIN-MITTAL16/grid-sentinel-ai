import { useState } from "react";
import type { Bus, PowerFlowResult } from "@/services/grid-engine/types";

const POSITION: Readonly<Record<string, readonly [number, number]>> = {
  rajasthan: [92, 72],
  gujarat: [260, 124],
  maharashtra: [468, 190],
  "madhya-pradesh": [370, 150],
  delhi: [592, 64],
};

export function DcNetworkView({
  buses,
  powerFlow,
  onBusSelect,
}: {
  buses: readonly Bus[];
  powerFlow: PowerFlowResult;
  onBusSelect?: (bus: Bus) => void;
}) {
  const [hoveredBus, setHoveredBus] = useState<string | null>(null);
  const selected = buses.find((bus) => bus.id === hoveredBus);
  return (
    <div>
      <svg
        viewBox="0 0 680 260"
        className="h-[245px] w-full"
        role="img"
        aria-label="DC power flow network"
      >
        {powerFlow.lineFlows.map((line) => {
          const from = POSITION[line.fromBus];
          const to = POSITION[line.toBus];
          if (!from || !to) return null;
          const color =
            line.status === "tripped"
              ? "#64748b"
              : line.status === "overload"
                ? "#fb7185"
                : line.status === "watch"
                  ? "#fbbf24"
                  : "#22d3ee";
          const duration = `${Math.max(0.7, 4 - Math.min(3, line.loadingPct / 35))}s`;
          return (
            <g key={line.lineId}>
              <path
                d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
                stroke="#13243e"
                strokeWidth="12"
                fill="none"
              />
              <path
                d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
                stroke={color}
                strokeWidth={line.status === "tripped" ? 3 : 5}
                strokeDasharray={line.status === "tripped" ? "8 9" : "14 9"}
                fill="none"
                className={line.status === "tripped" ? "opacity-50" : "animate-dash"}
                style={
                  line.status === "tripped"
                    ? undefined
                    : {
                        animationDirection: line.flowMW < 0 ? "reverse" : "normal",
                        animationDuration: duration,
                      }
                }
              />
              <text
                x={(from[0] + to[0]) / 2}
                y={(from[1] + to[1]) / 2 - 7}
                fill={color}
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {line.status === "tripped"
                  ? "TRIPPED"
                  : `${Math.round(line.flowMW)} MW // ${line.loadingPct.toFixed(1)}%`}
              </text>
            </g>
          );
        })}
        {buses.map((bus) => {
          const point = POSITION[bus.id];
          if (!point) return null;
          const active = selected?.id === bus.id;
          return (
            <g
              key={bus.id}
              onMouseEnter={() => setHoveredBus(bus.id)}
              onMouseLeave={() => setHoveredBus(null)}
              onClick={() => onBusSelect?.(bus)}
              className="cursor-pointer"
            >
              <circle
                cx={point[0]}
                cy={point[1]}
                r="16"
                fill="#070b17"
                stroke={active ? "#fbbf24" : "#67e8f9"}
                strokeWidth="3"
              />
              <circle cx={point[0]} cy={point[1]} r="4" fill="#a7f3d0" />
              <text
                x={point[0] + 20}
                y={point[1] - 17}
                fill="#e2e8f0"
                fontSize="10"
                fontFamily="monospace"
              >
                {bus.name.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      {selected && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-700 pt-2 font-mono text-[10px] text-slate-300">
          <span>BUS // {selected.name.toUpperCase()}</span>
          <span>GEN {Math.round(selected.generationMW)} MW</span>
          <span>DEMAND {Math.round(selected.loadMW)} MW</span>
          <span>NET {Math.round(powerFlow.netInjectionMW[selected.id])} MW</span>
          <span>DC ANGLE {powerFlow.busAnglesRad[selected.id].toFixed(6)} rad</span>
        </div>
      )}
    </div>
  );
}
