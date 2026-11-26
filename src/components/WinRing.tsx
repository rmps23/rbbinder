"use client";

import { useGrown } from "@/lib/useGrown";

// A win rate as a hexagon gauge with the figure in the middle (hexagon: the shape of the sets and of the logo's runes).
const SIZES = {
  sm: { box: 60, stroke: 5, text: "text-[13px]" },
  lg: { box: 136, stroke: 7, text: "text-[32px]" },
};
const HEX = "50.00,6.00 88.11,28.00 88.11,72.00 50.00,94.00 11.89,72.00 11.89,28.00";

export function WinRing({ rate, size = "sm" }: { rate: number | null; size?: keyof typeof SIZES }) {
  const { box, stroke, text } = SIZES[size];
  const grown = useGrown(rate ?? 0);
  const label = rate === null ? "–" : `${Math.round(rate * 100)}%`;
  const tone = rate === null ? "stroke-cavity" : rate >= 0.5 ? "stroke-ok" : "stroke-bad";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: box, height: box }} role="img" aria-label={rate === null ? "No decided games" : `${label} win rate`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
        <polygon points={HEX} fill="rgb(var(--track) / 0.05)" strokeWidth={stroke * (100 / box) * 0.9} strokeLinejoin="miter" className="stroke-cavity" />
        {rate !== null && rate > 0 && (
          <polygon
            points={HEX}
            fill="none"
            strokeWidth={stroke * (100 / box) * 0.9}
            strokeLinejoin="miter"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 * (1 - grown)}
            className={tone}
            data-gfx=""
            style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1)", filter: "drop-shadow(0 0 3px currentColor)" }}
          />
        )}
      </svg>
      <span className={`num font-bold leading-none tracking-tight text-t1 ${text}`}>{label}</span>
    </span>
  );
}
