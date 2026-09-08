import { useState } from "react";

type Station = {
  name: string;
  x: number;
  y: number;
  status: "active" | "historic" | "context";
  detail: string;
};

const STATIONS: Station[] = [
  { name: "Maitri", x: 345, y: 290, status: "active", detail: "Indian Antarctic station · representative twin context" },
  { name: "Bharati", x: 535, y: 255, status: "active", detail: "Indian Antarctic station · representative twin context" },
  { name: "Dakshin Gangotri", x: 350, y: 325, status: "historic", detail: "Historic Indian Antarctic station · not active" },
  { name: "Larsemann Hills", x: 555, y: 275, status: "context", detail: "Regional logistics context · not a station telemetry node" },
];

const ANTARCTICA_PATH = "M 765.0,524.0 L 765.0,524.0 L 761.8,520.9 L 762.9,525.0 L 756.9,523.6 L 758.3,520.5 L 760.5,521.0 L 757.7,519.2 L 761.5,521.0 L 756.8,517.6 L 753.6,519.9 L 751.0,518.2 L 752.8,521.0 L 756.4,518.1 L 753.6,520.9 L 757.7,521.1 L 754.1,521.3 L 757.4,522.1 L 753.3,523.6 L 749.6,521.3 L 747.3,523.5 L 746.7,519.0 L 743.9,519.4 L 747.0,522.5 L 743.3,521.2 L 740.9,524.2 L 742.8,520.5 L 736.8,521.3 L 738.5,518.4 L 733.6,519.1 L 734.7,521.3 L 730.0,518.2 L 728.3,519.6 L 727.5,516.5 L 723.1,519.6 L 727.3,514.1 L 723.8,514.7 L 725.4,512.7 L 721.3,514.3 L 720.5,519.4 L 720.1,515.0 L 718.7,517.8 L 717.6,514.4 L 713.4,514.9 L 712.9,518.2 L 709.8,517.6 L 711.1,521.4 L 713.3,520.7 L 711.1,521.9 L 709.3,517.4 L 707.0,515.2 L 704.9,517.6 L 704.8,515.6 L 707.2,514.5 L 705.9,512.3 L 708.1,514.2 L 708.8,512.5 L 708.5,515.0 L 709.0,511.9 L 712.6,511.5 L 706.1,507.1 L 706.5,509.6 L 703.9,508.5 L 704.8,504.6 L 701.7,508.0 L 697.9,501.4 L 693.5,504.5 L 691.9,500.9 L 688.0,501.9 L 680.6,498.2 L 682.1,496.7 L 678.7,497.9 L 681.2,496.4 L 678.6,494.8 L 675.3,497.2 L 672.1,492.6 L 673.2,494.7 L 671.5,496.5 L 672.3,501.8 L 671.3,499.8 L 665.6,501.2 L 653.6,493.2 L 634.1,491.3 L 633.3,487.5 L 605.7,468.7 L 577.7,461.2 L 572.4,456.1 L 562.4,455.1 L 531.5,436.5 L 512.6,432.1 L 493.7,420.8 L 478.7,416.6 L 461.6,412.9 L 445.2,419.8 L 412.7,448.9 L 402.0,454.4 L 392.1,457.4 L 386.7,454.1 L 357.7,464.0 L 316.3,471.4 L 295.1,479.6 L 282.4,491.7 L 278.8,487.6 L 259.3,489.8 L 249.9,472.8 L 239.8,467.5 L 234.1,468.7 L 240.5,474.4 L 233.3,481.6 L 215.1,479.2 L 211.1,470.3 L 206.5,472.6 L 199.7,464.1 L 190.5,464.6 L 189.4,448.6 L 180.6,448.5 L 180.1,441.5 L 169.9,440.1 L 169.0,428.7 L 156.3,417.1 L 152.3,414.8 L 146.1,420.9 L 109.5,410.1 L 83.0,421.9 L 75.7,415.3 L 75.8,420.9 L 61.7,428.8 L 61.8,435.9 L 53.4,440.4 L 50.0,435.4 L 53.0,425.5 L 64.6,410.2 L 89.1,397.9 L 77.6,398.1 L 67.8,375.0 L 55.4,373.5 L 45.9,364.1 L 42.4,356.4 L 47.1,348.1 L 41.7,344.5 L 47.0,331.3 L 35.0,300.6 L 45.6,294.2 L 49.4,309.9 L 66.4,308.4 L 78.6,321.1 L 93.7,318.6 L 92.9,308.0 L 86.4,305.2 L 64.8,308.1 L 59.9,281.9 L 64.5,277.4 L 59.8,276.2 L 58.2,283.1 L 49.6,276.6 L 64.8,274.7 L 77.7,258.0 L 91.2,258.2 L 101.6,229.5 L 119.9,216.4 L 123.8,193.3 L 116.1,200.9 L 134.2,166.4 L 131.7,183.5 L 145.0,179.9 L 149.5,169.6 L 163.3,162.4 L 176.1,169.2 L 180.8,160.1 L 201.2,149.9 L 215.3,147.5 L 227.1,157.6 L 222.9,149.3 L 248.3,142.7 L 275.2,106.4 L 305.7,92.8 L 323.2,93.5 L 319.6,89.1 L 324.3,87.9 L 355.7,100.9 L 368.5,95.6 L 372.3,102.1 L 374.8,99.7 L 376.1,125.0 L 383.0,136.4 L 385.0,142.6 L 381.0,151.5 L 386.5,147.0 L 389.8,127.3 L 404.2,132.2 L 413.6,118.4 L 420.0,130.2 L 418.7,125.8 L 415.8,109.5 L 421.1,110.2 L 423.1,105.2 L 418.0,108.6 L 413.6,97.4 L 422.2,92.3 L 420.4,89.5 L 435.3,85.2 L 434.5,81.8 L 439.3,85.0 L 438.2,81.2 L 445.2,82.0 L 446.6,78.1 L 447.8,81.1 L 447.7,77.6 L 454.1,81.6 L 453.8,73.9 L 463.8,76.6 L 462.6,84.7 L 467.8,78.1 L 466.8,84.1 L 473.4,91.3 L 477.4,69.8 L 494.5,64.8 L 518.0,46.1 L 542.4,42.2 L 567.5,44.6 L 585.3,35.0 L 592.1,36.2 L 610.0,49.3 L 617.4,61.7 Z";

export function AntarcticaMap({ risk }: { risk: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedStation = STATIONS.find((station) => station.name === selected);

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden rounded-xl border border-[oklch(0.72_0.18_245/0.16)] bg-[radial-gradient(circle_at_50%_48%,oklch(0.18_0.05_220/0.65),oklch(0.07_0.02_255)_65%)]">
      <svg viewBox="0 0 800 560" className="absolute inset-0 w-full h-full" role="img" aria-label="Antarctica research station energy network map">
        <defs>
          <filter id="ice-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.72 0.18 245 / 0.09)" strokeWidth="0.7"/></pattern>
        </defs>
        <rect width="800" height="560" fill="url(#grid)" opacity="0.45" />
        <g opacity="0.22" fill="none" stroke="oklch(0.72 0.18 245 / 0.45)">
          <circle cx="400" cy="280" r="220"/><circle cx="400" cy="280" r="150"/><circle cx="400" cy="280" r="80"/>
        </g>
        <path d={ANTARCTICA_PATH} fill="url(#ice)" stroke="oklch(0.72 0.18 245 / 0.9)" strokeWidth="2" filter="url(#ice-glow)" opacity="0.88" />
        <defs><linearGradient id="ice" x1="0" y1="0" x2="1" y2="1"><stop stopColor="oklch(0.86 0.05 220)"/><stop offset="0.5" stopColor="oklch(0.68 0.05 220)"/><stop offset="1" stopColor="oklch(0.43 0.05 235)"/></linearGradient></defs>
        <g fill="none" stroke="oklch(0.72 0.18 245 / 0.8)" strokeWidth="2" strokeDasharray="5 7">
          <path d="M345 290 L535 255 L555 275 L345 290" />
          <path d="M345 290 L350 325" />
        </g>
        <g fill="none" stroke="oklch(0.85 0.21 145 / 0.75)" strokeWidth="2">
          <path d="M345 290 L535 255"/><path d="M535 255 L555 275"/><path d="M345 290 L350 325"/>
        </g>
        {STATIONS.map((station) => {
          const color = station.status === "active" ? "oklch(0.85 0.21 145)" : station.status === "historic" ? "oklch(0.82 0.17 75)" : "oklch(0.72 0.18 245)";
          return (
            <g key={station.name} onClick={() => setSelected(station.name)} className="cursor-pointer">
              <circle cx={station.x} cy={station.y} r="14" fill={color} opacity="0.18" />
              <circle cx={station.x} cy={station.y} r="6" fill={color} stroke="oklch(0.1 0.02 260)" strokeWidth="2" />
              <text x={station.x + 10} y={station.y - 10} fill="white" fontSize="13" fontWeight="600">{station.name}</text>
            </g>
          );
        })}
        <g fill="white" fontFamily="monospace" fontSize="10" opacity="0.6">
          <text x="400" y="285" textAnchor="middle" letterSpacing="5">ANTARCTICA</text>
          <text x="48" y="520">N</text><text x="65" y="520">0</text><text x="180" y="520">500</text><text x="300" y="520">1,000 km</text>
        </g>
        <g stroke="oklch(0.68 0.24 25 / 0.7)" fill="none" strokeWidth="2" strokeDasharray="4 8">
          <path d="M690 100 C650 140 620 180 600 220"/><path d="M690 100 C680 170 670 230 640 280"/>
        </g>
        <text x="655" y="88" fill="oklch(0.82 0.17 75)" fontSize="11" fontFamily="monospace">WEATHER FRONT</text>
      </svg>
      <div className="absolute left-4 top-4 flex flex-wrap gap-2 text-[10px] font-mono">
        <span className="px-2 py-1 rounded bg-black/40 border border-white/10">● STATION ACTIVE</span>
        <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-cyan-300">↝ POWER FLOW</span>
        <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-amber-300">● WATCH</span>
        <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-red-300">● HIGH RISK</span>
      </div>
      <div className="absolute right-4 top-4 text-right text-[10px] font-mono text-muted-foreground">
        <div className="text-[oklch(0.85_0.21_145)]">● SIMULATION ONLINE</div>
        <div>RISK INDEX {risk}/100</div>
      </div>
      {selectedStation && (
        <button onClick={() => setSelected(null)} className="absolute left-4 bottom-4 max-w-xs rounded-lg border border-[oklch(0.72_0.18_245/0.35)] bg-[oklch(0.08_0.02_255/0.94)] p-3 text-left shadow-xl">
          <div className="hud-label">STATION CONTEXT</div>
          <div className="font-display text-sm mt-1">{selectedStation.name}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{selectedStation.detail}</div>
        </button>
      )}
    </div>
  );
}
