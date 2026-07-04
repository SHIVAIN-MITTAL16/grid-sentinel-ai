import { useMemo, useState, type MouseEvent } from "react";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { BatteryCharging, Droplet, Flame, Sun, Wind, Zap } from "lucide-react";
import indiaGeo from "@/lib/india-geo.json";
import { STATES, type StateData } from "@/lib/grid-data";
import { INDIAN_STATE_CAPITALS } from "@/services/weather-service";

type HubKind = "solar" | "wind" | "hydro" | "thermal" | "battery";
type MapFeature = Feature<Geometry, { name: string }>;
type Projector = (lon: number, lat: number) => [number, number];
type PathGenerator = (feature: MapFeature) => string;

type Corridor = {
  fromState: string;
  toState: string;
  load: number;
  label: string;
};

type GridAsset = {
  state: string;
  kind: HubKind | "substation";
  label: string;
  scale: number;
};

export interface HoverPayload {
  id?: string;
  name: string;
  data?: StateData;
}

interface Props {
  width?: number;
  height?: number;
  data?: StateData[];
  onHover?: (payload: HoverPayload | null) => void;
}

const VB_W = 900;
const VB_H = 980;
const SCORE_MAX = 100;

const ISLAND_FEATURES = new Set(["Andaman and Nicobar", "Lakshadweep"]);

const GEO_DISPLAY_NAME: Record<string, string> = {
  Orissa: "Odisha",
  Uttaranchal: "Uttarakhand",
  "Jammu and Kashmir": "Jammu and Kashmir",
  "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
  "Daman and Diu": "Daman and Diu",
};

const CORRIDORS: readonly Corridor[] = [
  { fromState: "Rajasthan", toState: "Delhi", load: 0.9, label: "Rajasthan to Delhi" },
  { fromState: "Gujarat", toState: "Maharashtra", load: 0.82, label: "Gujarat to Maharashtra" },
  { fromState: "Gujarat", toState: "Rajasthan", load: 0.64, label: "Gujarat to Rajasthan" },
  {
    fromState: "Maharashtra",
    toState: "Madhya Pradesh",
    load: 0.74,
    label: "Maharashtra to Madhya Pradesh",
  },
  { fromState: "Maharashtra", toState: "Karnataka", load: 0.7, label: "Maharashtra to Karnataka" },
  { fromState: "Punjab", toState: "Delhi", load: 0.62, label: "Punjab to Delhi" },
  { fromState: "Haryana", toState: "Delhi", load: 0.72, label: "Haryana to Delhi" },
  { fromState: "Himachal Pradesh", toState: "Punjab", load: 0.46, label: "Himachal to Punjab" },
  {
    fromState: "Uttarakhand",
    toState: "Uttar Pradesh",
    load: 0.5,
    label: "Uttarakhand to Uttar Pradesh",
  },
  { fromState: "Delhi", toState: "Madhya Pradesh", load: 0.76, label: "North to Central" },
  {
    fromState: "Madhya Pradesh",
    toState: "Uttar Pradesh",
    load: 0.68,
    label: "Central to Uttar Pradesh",
  },
  {
    fromState: "Madhya Pradesh",
    toState: "Chhattisgarh",
    load: 0.6,
    label: "Madhya Pradesh to Chhattisgarh",
  },
  { fromState: "Uttar Pradesh", toState: "Bihar", load: 0.58, label: "Uttar Pradesh to Bihar" },
  { fromState: "Jharkhand", toState: "Bihar", load: 0.5, label: "Jharkhand to Bihar" },
  { fromState: "Jharkhand", toState: "West Bengal", load: 0.54, label: "Jharkhand to Bengal" },
  { fromState: "Bihar", toState: "West Bengal", load: 0.66, label: "Bihar to Bengal" },
  { fromState: "Chhattisgarh", toState: "Odisha", load: 0.55, label: "Chhattisgarh to Odisha" },
  {
    fromState: "Chhattisgarh",
    toState: "Jharkhand",
    load: 0.5,
    label: "Chhattisgarh to Jharkhand",
  },
  { fromState: "West Bengal", toState: "Odisha", load: 0.48, label: "Bengal to Odisha" },
  { fromState: "Odisha", toState: "Telangana", load: 0.52, label: "Odisha to Telangana" },
  {
    fromState: "Telangana",
    toState: "Andhra Pradesh",
    load: 0.68,
    label: "Telangana to Andhra Pradesh",
  },
  { fromState: "Telangana", toState: "Tamil Nadu", load: 0.7, label: "Telangana to Tamil Nadu" },
  {
    fromState: "Andhra Pradesh",
    toState: "Tamil Nadu",
    load: 0.62,
    label: "Andhra Pradesh to Tamil Nadu",
  },
  {
    fromState: "Andhra Pradesh",
    toState: "Karnataka",
    load: 0.58,
    label: "Andhra Pradesh to Karnataka",
  },
  { fromState: "Karnataka", toState: "Tamil Nadu", load: 0.74, label: "Karnataka to Tamil Nadu" },
  { fromState: "Karnataka", toState: "Kerala", load: 0.56, label: "Karnataka to Kerala" },
  { fromState: "Kerala", toState: "Tamil Nadu", load: 0.45, label: "Kerala to Tamil Nadu" },
  { fromState: "Assam", toState: "West Bengal", load: 0.42, label: "North East to Bengal" },
  { fromState: "Arunachal Pradesh", toState: "Assam", load: 0.5, label: "Arunachal to Assam" },
  { fromState: "Meghalaya", toState: "Assam", load: 0.4, label: "Meghalaya to Assam" },
  { fromState: "Nagaland", toState: "Assam", load: 0.38, label: "Nagaland to Assam" },
  { fromState: "Manipur", toState: "Assam", load: 0.36, label: "Manipur to Assam" },
  { fromState: "Tripura", toState: "Assam", load: 0.34, label: "Tripura to Assam" },
];

const GRID_ASSETS: readonly GridAsset[] = [
  { state: "Rajasthan", kind: "solar", label: "Rajasthan Solar Hub", scale: 1.22 },
  { state: "Gujarat", kind: "solar", label: "Gujarat Solar Hub", scale: 1.05 },
  { state: "Karnataka", kind: "solar", label: "Karnataka Solar Hub", scale: 1.1 },
  { state: "Andhra Pradesh", kind: "solar", label: "Andhra Solar Hub", scale: 0.95 },
  { state: "Gujarat", kind: "wind", label: "Gujarat Wind Hub", scale: 1.05 },
  { state: "Tamil Nadu", kind: "wind", label: "Tamil Nadu Wind Hub", scale: 1.2 },
  { state: "Karnataka", kind: "wind", label: "Karnataka Wind Hub", scale: 0.95 },
  { state: "Himachal Pradesh", kind: "hydro", label: "Himachal Hydro Hub", scale: 1.05 },
  { state: "Uttarakhand", kind: "hydro", label: "Uttarakhand Hydro Hub", scale: 0.95 },
  { state: "Kerala", kind: "hydro", label: "Kerala Hydro Hub", scale: 0.9 },
  { state: "Arunachal Pradesh", kind: "hydro", label: "North East Hydro Hub", scale: 1.0 },
  { state: "Chhattisgarh", kind: "thermal", label: "Chhattisgarh Thermal Plant", scale: 1.08 },
  { state: "Maharashtra", kind: "thermal", label: "Maharashtra Thermal Plant", scale: 0.95 },
  { state: "Bihar", kind: "thermal", label: "Bihar Thermal Plant", scale: 0.9 },
  { state: "West Bengal", kind: "thermal", label: "Bengal Thermal Plant", scale: 0.9 },
  { state: "Delhi", kind: "battery", label: "Delhi BESS", scale: 0.82 },
  { state: "Maharashtra", kind: "battery", label: "Maharashtra BESS", scale: 0.82 },
  { state: "Tamil Nadu", kind: "battery", label: "Tamil Nadu BESS", scale: 0.82 },
  { state: "Delhi", kind: "substation", label: "Northern Substation", scale: 1.0 },
  { state: "Madhya Pradesh", kind: "substation", label: "Central Substation", scale: 1.08 },
  { state: "Odisha", kind: "substation", label: "Eastern Substation", scale: 0.95 },
  { state: "Karnataka", kind: "substation", label: "Southern Substation", scale: 0.95 },
  { state: "Assam", kind: "substation", label: "North East Substation", scale: 0.9 },
];

const HUB_COLOR: Record<HubKind | "substation", string> = {
  solar: "oklch(0.86 0.18 85)",
  wind: "oklch(0.72 0.18 200)",
  hydro: "oklch(0.72 0.18 245)",
  thermal: "oklch(0.68 0.18 35)",
  battery: "oklch(0.85 0.21 145)",
  substation: "oklch(0.96 0.012 240)",
};

const HUB_ICON: Record<HubKind | "substation", typeof Sun> = {
  solar: Sun,
  wind: Wind,
  hydro: Droplet,
  thermal: Flame,
  battery: BatteryCharging,
  substation: Zap,
};

export function IndiaGeoMap({ width, height = 720, data = STATES, onHover }: Props) {
  const [hover, setHover] = useState<HoverPayload | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const map = useMemo(() => buildMapProjection(), []);
  const stateLookup = useMemo(() => buildStateLookup(data), [data]);
  const capitalLookup = useMemo(() => buildCapitalLookup(), []);

  function handleHover(feature: MapFeature, event: MouseEvent<SVGPathElement>) {
    const name = getDisplayName(feature.properties.name);
    const liveData = findStateData(name, stateLookup);
    const payload = { id: liveData?.id, name, data: liveData };
    const svg = event.currentTarget.ownerSVGElement;

    setHover(payload);
    onHover?.(payload);
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function handleLeave() {
    setHover(null);
    setPointer(null);
    onHover?.(null);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height, width }}>
      <MapLighting />

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="relative w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <MapDefinitions />
        <SoftMapGlow />

        <StateLayer
          features={map.mainlandFeatures}
          hover={hover}
          pathGen={map.mainlandPath}
          stateLookup={stateLookup}
          onHover={handleHover}
          onLeave={handleLeave}
        />
        <TransmissionLayer
          corridors={CORRIDORS}
          project={map.mainlandProject}
          capitalLookup={capitalLookup}
        />
        <GridAssetLayer
          assets={GRID_ASSETS}
          project={map.mainlandProject}
          capitalLookup={capitalLookup}
        />
        <IslandInset
          label="Lakshadweep"
          features={map.lakshadweepFeatures}
          pathGen={map.lakshadweepPath}
          hover={hover}
          stateLookup={stateLookup}
          onHover={handleHover}
          onLeave={handleLeave}
        />
        <IslandInset
          label="Andaman & Nicobar"
          features={map.andamanFeatures}
          pathGen={map.andamanPath}
          hover={hover}
          stateLookup={stateLookup}
          onHover={handleHover}
          onLeave={handleLeave}
        />
      </svg>

      {hover && pointer && <HoverTelemetryPanel hover={hover} x={pointer.x} y={pointer.y} />}
      <MapLegend instrumentedCount={data.length} />
    </div>
  );
}

function StateLayer({
  features,
  hover,
  pathGen,
  stateLookup,
  onHover,
  onLeave,
}: {
  features: readonly MapFeature[];
  hover: HoverPayload | null;
  pathGen: PathGenerator;
  stateLookup: Map<string, StateData>;
  onHover: (feature: MapFeature, event: MouseEvent<SVGPathElement>) => void;
  onLeave: () => void;
}) {
  return (
    <g>
      {features.map((feature) => {
        const name = getDisplayName(feature.properties.name);
        const liveData = findStateData(name, stateLookup);
        const color = liveData ? riskTone(liveData.risk) : "oklch(0.72 0.18 245 / 0.42)";
        const hovered = hover?.name === name;
        const d = pathGen(feature);

        return (
          <g key={name}>
            <path
              d={d}
              fill="url(#state-fill)"
              stroke={color}
              strokeOpacity={hovered ? 0.95 : 0.5}
              strokeWidth={hovered ? 1.45 : 0.68}
              className="transition-all duration-300"
              style={{ cursor: "pointer", filter: hovered ? "url(#state-glow)" : undefined }}
              onMouseMove={(event) => onHover(feature, event)}
              onMouseLeave={onLeave}
            />
            <path
              d={d}
              fill={color}
              opacity={liveData ? (hovered ? 0.28 : 0.1) : 0.04}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}

function TransmissionLayer({
  corridors,
  project,
  capitalLookup,
}: {
  corridors: readonly Corridor[];
  project: Projector;
  capitalLookup: Map<string, [number, number]>;
}) {
  return (
    <g>
      {corridors.map((corridor) => {
        const from = capitalLookup.get(normalizeName(corridor.fromState));
        const to = capitalLookup.get(normalizeName(corridor.toState));
        if (!from || !to) return null;

        const path = buildCurve(project(from[0], from[1]), project(to[0], to[1]), corridor.load);
        const duration = 2.4 + (1 - corridor.load) * 3.6;

        return (
          <g key={corridor.label}>
            <path
              d={path}
              stroke="oklch(0.85 0.21 145 / 0.22)"
              strokeWidth={6.1 * corridor.load}
              fill="none"
            />
            <path
              d={path}
              stroke="url(#corridor)"
              strokeWidth={1 + corridor.load * 1.45}
              fill="none"
              opacity={0.9}
            />
            <path
              d={path}
              stroke="oklch(0.72 0.18 245)"
              strokeWidth="0.56"
              strokeDasharray="2 6"
              fill="none"
              opacity="0.52"
              className="animate-dash"
            />
            <FlowParticle
              path={path}
              duration={duration}
              delay={0}
              radius={1.8 + corridor.load * 1.8}
              color="oklch(0.85 0.21 145)"
            />
            <FlowParticle
              path={path}
              duration={duration}
              delay={duration * 0.5}
              radius={1.2 + corridor.load * 1.15}
              color="oklch(0.96 0.012 240)"
            />
          </g>
        );
      })}
    </g>
  );
}

function GridAssetLayer({
  assets,
  project,
  capitalLookup,
}: {
  assets: readonly GridAsset[];
  project: Projector;
  capitalLookup: Map<string, [number, number]>;
}) {
  return (
    <g>
      {assets.map((asset) => {
        const point = capitalLookup.get(normalizeName(asset.state));
        if (!point) return null;

        const [x, y] = project(point[0], point[1]);
        const color = HUB_COLOR[asset.kind];
        const Icon = HUB_ICON[asset.kind];
        const size = 24 * asset.scale;

        return (
          <g key={asset.label} transform={`translate(${x - size / 2}, ${y - size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.94}
              fill={color}
              opacity="0.22"
              filter="url(#hub-glow)"
            >
              <animate
                attributeName="opacity"
                values="0.16;0.42;0.16"
                dur="2.55s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.5}
              fill="oklch(0.12 0.025 260 / 0.94)"
              stroke={color}
              strokeOpacity="0.94"
              strokeWidth="0.9"
            />
            <foreignObject
              x={size * 0.22}
              y={size * 0.22}
              width={size * 0.56}
              height={size * 0.56}
              pointerEvents="none"
            >
              <div
                style={{ color, width: "100%", height: "100%" }}
                className="grid place-items-center"
              >
                <Icon size={Math.max(9, size * 0.46)} strokeWidth={2.1} />
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}

function IslandInset({
  label,
  features,
  pathGen,
  hover,
  stateLookup,
  onHover,
  onLeave,
}: {
  label: string;
  features: readonly MapFeature[];
  pathGen: PathGenerator;
  hover: HoverPayload | null;
  stateLookup: Map<string, StateData>;
  onHover: (feature: MapFeature, event: MouseEvent<SVGPathElement>) => void;
  onLeave: () => void;
}) {
  if (features.length === 0) return null;

  return (
    <g>
      <StateLayer
        features={features}
        hover={hover}
        pathGen={pathGen}
        stateLookup={stateLookup}
        onHover={onHover}
        onLeave={onLeave}
      />
      <text
        className="font-mono"
        x={label === "Lakshadweep" ? 132 : 725}
        y={label === "Lakshadweep" ? 842 : 842}
        fill="oklch(0.68 0.025 250)"
        fontSize="10"
      >
        {label}
      </text>
    </g>
  );
}

function HoverTelemetryPanel({ hover, x, y }: { hover: HoverPayload; x: number; y: number }) {
  const state = hover.data;
  const stability = state ? Math.max(0, SCORE_MAX - state.risk) : undefined;

  return (
    <div
      className="absolute z-30 panel panel-glow p-4 w-[310px] pointer-events-none animate-fade-up"
      style={{
        left: `min(calc(${x}px + 18px), calc(100% - 20rem))`,
        top: `min(calc(${y}px + 18px), calc(100% - 21rem))`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="hud-label">Operational Telemetry</div>
          <div className="text-base font-display font-semibold">{hover.name}</div>
        </div>
        <RiskBadge risk={state?.risk} />
      </div>

      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs font-mono">
        <MetricRow label="Demand" value={formatNumber(state?.demand, " GW")} />
        <MetricRow label="Renewable Output" value={formatNumber(state?.renewable, " GW")} />
        <MetricRow label="Grid Stability" value={formatNumber(stability, " %", 0)} />
        <MetricRow label="Battery Reserve" value={formatNumber(state?.battery, " MWh", 0)} />
        <MetricRow label="Monte Carlo Risk" value={state ? `${state.risk} / 100` : "--"} />
        <MetricRow label="Blackout Probability" value={formatNumber(state?.blackout, " %", 0)} />
      </div>

      <div className="mt-3 pt-3 border-t border-[oklch(0.72_0.18_245/0.18)]">
        <div className="hud-label mb-1">Optimizer Recommendation</div>
        <div className="text-xs text-foreground/90 leading-relaxed min-h-[1.5em]">
          {state?.recommendation ??
            "No live backend telemetry available for this state or union territory."}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
          {state ? "LIVE" : "GEO ONLY"}
        </span>
        <span>{state ? "Backend synced" : "Awaiting feed"}</span>
      </div>
    </div>
  );
}

function MapDefinitions() {
  return (
    <defs>
      <filter id="state-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="hub-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.8" />
      </filter>
      <linearGradient id="state-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="oklch(0.22 0.04 258 / 0.96)" />
        <stop offset="100%" stopColor="oklch(0.13 0.03 260 / 0.96)" />
      </linearGradient>
      <linearGradient id="corridor" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="oklch(0.72 0.18 245 / 0)" />
        <stop offset="48%" stopColor="oklch(0.72 0.18 245 / 0.88)" />
        <stop offset="100%" stopColor="oklch(0.85 0.21 145 / 0)" />
      </linearGradient>
    </defs>
  );
}

function MapLighting() {
  return (
    <>
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 52%, oklch(0.72 0.18 245 / 0.2), transparent 72%)",
        }}
      />
    </>
  );
}

function SoftMapGlow() {
  return (
    <g
      style={{ transformOrigin: `${VB_W / 2}px ${VB_H / 2}px` }}
      className="animate-sweep"
      opacity="0.16"
    >
      <defs>
        <radialGradient id="sweep-grad">
          <stop offset="0%" stopColor="oklch(0.72 0.18 245 / 0.34)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx={VB_W / 2} cy={VB_H / 2} r={Math.min(VB_W, VB_H) / 2.2} fill="url(#sweep-grad)" />
    </g>
  );
}

function FlowParticle({
  path,
  duration,
  delay,
  radius,
  color,
}: {
  path: string;
  duration: number;
  delay: number;
  radius: number;
  color: string;
}) {
  return (
    <circle r={radius} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      <animateMotion
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        path={path}
      />
    </circle>
  );
}

function MapLegend({ instrumentedCount }: { instrumentedCount: number }) {
  return (
    <>
      <div className="absolute bottom-3 left-3 panel px-3 py-2 text-[10px] font-mono flex gap-3">
        <LegendDot color="oklch(0.85 0.21 145)" label="HEALTHY" />
        <LegendDot color="oklch(0.86 0.18 85)" label="MODERATE" />
        <LegendDot color="oklch(0.72 0.2 50)" label="HIGH" />
        <LegendDot color="oklch(0.68 0.24 25)" label="CRITICAL" />
      </div>
      <div className="absolute top-3 right-3 panel px-3 py-1.5 text-[10px] font-mono text-muted-foreground flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.21_145)] animate-flicker" />
        LIVE TELEMETRY · NLDC · {instrumentedCount} INSTRUMENTED NODES
      </div>
      <div className="absolute top-3 left-3 panel px-3 py-1.5 text-[10px] font-mono text-muted-foreground flex items-center gap-3">
        <Legend kind="solar" label="Solar" />
        <Legend kind="wind" label="Wind" />
        <Legend kind="hydro" label="Hydro" />
        <Legend kind="thermal" label="Thermal" />
        <Legend kind="battery" label="BESS" />
      </div>
    </>
  );
}

function RiskBadge({ risk }: { risk?: number }) {
  if (risk === undefined) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground border border-[oklch(0.72_0.18_245/0.22)]">
        GEO ONLY
      </span>
    );
  }

  const color = riskTone(risk);
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-mono"
      style={{ background: `${color}22`, color, border: `1px solid ${color}` }}
    >
      RISK {risk}
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">{value}</div>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}

function Legend({ kind, label }: { kind: HubKind; label: string }) {
  const Icon = HUB_ICON[kind];
  const color = HUB_COLOR[kind];

  return (
    <span className="flex items-center gap-1.5" style={{ color }}>
      <Icon size={10} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function buildMapProjection() {
  const fc = indiaGeo as FeatureCollection<Geometry, { name: string }>;
  const mainlandFeatures = fc.features.filter(
    (feature) => !ISLAND_FEATURES.has(feature.properties.name),
  );
  const andamanFeatures = fc.features.filter(
    (feature) => feature.properties.name === "Andaman and Nicobar",
  );
  const lakshadweepFeatures = fc.features.filter(
    (feature) => feature.properties.name === "Lakshadweep",
  );

  const mainlandProject = createMercatorProjector(mainlandFeatures, [
    [30, 4],
    [870, 962],
  ]);
  const andamanProject = createMercatorProjector(andamanFeatures, [
    [728, 742],
    [830, 900],
  ]);
  const lakshadweepProject = createMercatorProjector(lakshadweepFeatures, [
    [116, 744],
    [198, 884],
  ]);

  return {
    mainlandFeatures,
    andamanFeatures,
    lakshadweepFeatures,
    mainlandPath: createPathGenerator(mainlandProject),
    andamanPath: createPathGenerator(andamanProject),
    lakshadweepPath: createPathGenerator(lakshadweepProject),
    mainlandProject,
  };
}

function createPathGenerator(project: Projector): PathGenerator {
  return (feature) => geometryToPath(feature.geometry, project);
}

function geometryToPath(geometry: Geometry, project: Projector): string {
  if (geometry.type === "Polygon") return polygonToPath(geometry.coordinates, project);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygonToPath(polygon, project)).join(" ");
  }

  return "";
}

function polygonToPath(polygon: Position[][], project: Projector): string {
  return polygon.map((ring) => ringToPath(ring, project)).join(" ");
}

function ringToPath(ring: Position[], project: Projector): string {
  return (
    ring
      .map((position, index) => {
        const [x, y] = project(Number(position[0]), Number(position[1]));
        return `${index === 0 ? "M" : "L"}${roundPathNumber(x)},${roundPathNumber(y)}`;
      })
      .join("") + "Z"
  );
}

function createMercatorProjector(
  features: readonly MapFeature[],
  extent: [[number, number], [number, number]],
): Projector {
  const bounds = getProjectedBounds(features);
  const [[left, top], [right, bottom]] = extent;
  const width = right - left;
  const height = bottom - top;
  const spanX = Math.max(0.000001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.000001, bounds.maxY - bounds.minY);
  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = left + (width - spanX * scale) / 2;
  const offsetY = top + (height - spanY * scale) / 2;

  return (lon, lat) => {
    const point = mercatorPoint(lon, lat);
    return [offsetX + (point.x - bounds.minX) * scale, offsetY + (bounds.maxY - point.y) * scale];
  };
}

function getProjectedBounds(features: readonly MapFeature[]) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const feature of features) {
    forEachPosition(feature.geometry, (position) => {
      const point = mercatorPoint(Number(position[0]), Number(position[1]));
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    });
  }

  return bounds;
}

function forEachPosition(geometry: Geometry, visit: (position: Position) => void) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) for (const position of ring) visit(position);
  }

  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) for (const position of ring) visit(position);
    }
  }
}

function mercatorPoint(lon: number, lat: number) {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const radians = Math.PI / 180;

  return {
    x: lon * radians,
    y: Math.log(Math.tan(Math.PI / 4 + (clampedLat * radians) / 2)),
  };
}

function roundPathNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}

function buildStateLookup(data: readonly StateData[]) {
  const lookup = new Map<string, StateData>();

  for (const state of data) {
    lookup.set(normalizeName(state.name), state);
    lookup.set(normalizeName(state.id), state);
  }

  return lookup;
}

function buildCapitalLookup() {
  const lookup = new Map<string, [number, number]>();

  for (const capital of INDIAN_STATE_CAPITALS) {
    lookup.set(normalizeName(capital.state), [capital.longitude, capital.latitude]);
  }

  return lookup;
}

function findStateData(name: string, lookup: Map<string, StateData>) {
  return lookup.get(normalizeName(name));
}

function getDisplayName(name: string) {
  return GEO_DISPLAY_NAME[name] ?? name;
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function buildCurve(from: [number, number], to: [number, number], load: number) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const bend = x2 >= x1 ? 0.08 : -0.08;
  const mx = (x1 + x2) / 2 + (y2 - y1) * bend * load;
  const my = (y1 + y2) / 2 - (x2 - x1) * bend * load;

  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
}

function riskTone(risk: number) {
  if (risk >= 70) return "oklch(0.68 0.24 25)";
  if (risk >= 45) return "oklch(0.72 0.2 50)";
  if (risk >= 30) return "oklch(0.86 0.18 85)";
  return "oklch(0.85 0.21 145)";
}

function formatNumber(value: number | undefined, unit: string, digits = 1) {
  return value === undefined ? "--" : `${value.toFixed(digits)}${unit}`;
}
