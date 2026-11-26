"use client";

import { useId } from "react";
import { useGrown } from "@/lib/useGrown";

// A win rate as a drop of blood that fills up to the rate. The better the rate, the livelier the blood:
// a glowing rosy red at the top, a dead, dark red at the bottom. The surface ripples on hover and a few
// drips hang from it.
const SIZES = {
  sm: { h: 66, text: "text-[13px]" },
  lg: { h: 140, text: "text-[30px]" },
};
const DROP = "M50 4C50 4 12 50 12 78C12 99 29 116 50 116C71 116 88 99 88 78C88 50 50 4 50 4Z";
const WAVE = "M-24 0 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 L124 0 V140 H-24 Z";
const DRIPS = [
  [27, 8],
  [49, 14],
  [70, 6],
];

export function WinRing({ rate, size = "sm" }: { rate: number | null; size?: keyof typeof SIZES }) {
  const { h, text } = SIZES[size];
  const w = Math.round(h * (100 / 120));
  const id = useId().replace(/:/g, "");
  const t = rate === null ? 0 : Math.min(1, Math.max(0, rate));
  const grown = useGrown(t * 100);
  const level = 116 - (grown / 100) * 108; // surface height inside the drop
  // blood colour from dead (low rate) to alive and glowing (high rate)
  const sat = 42 + 50 * t;
  const light = 15 + 43 * t;
  const top = `hsl(347 ${sat}% ${light + 9}%)`;
  const bottom = `hsl(352 ${sat}% ${Math.max(8, light - 13)}%)`;
  const edge = `hsl(347 ${sat}% ${light + 20}%)`;
  const glow = t > 0.45 ? (t - 0.45) / 0.55 : 0;
  const label = rate === null ? "–" : `${Math.round(rate * 100)}%`;
  return (
    <span className="blood relative inline-flex shrink-0 items-center justify-center" style={{ width: w, height: h }} role="img" aria-label={rate === null ? "No decided games" : `${label} win rate`}>
      <svg
        viewBox="0 0 100 120"
        width={w}
        height={h}
        className="absolute inset-0"
        style={{ filter: glow ? `drop-shadow(0 0 ${3 + 9 * glow}px rgb(255 70 120 / ${0.25 + 0.5 * glow}))` : undefined }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`c${id}`}>
            <path d={DROP} />
          </clipPath>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        </defs>
        <path d={DROP} fill="rgb(20 8 12 / 0.85)" />
        <g clipPath={`url(#c${id})`}>
          <g data-gfx="" style={{ transform: `translateY(${level}px)`, transition: "transform 1100ms cubic-bezier(0.22,1,0.36,1)" }}>
            <path className="blood-wave" d={WAVE} fill={`url(#g${id})`} />
            {grown > 6 &&
              DRIPS.map(([x, len], i) => (
                <path key={i} d={`M${x} 0 v${len} a2.4 2.4 0 0 0 4.8 0 v-${len} Z`} fill={top} />
              ))}
          </g>
          <path d="M31 62 Q26 80 33 96" fill="none" stroke="white" strokeOpacity={0.12 + 0.25 * t} strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d={DROP} fill="none" stroke={edge} strokeWidth="2.4" strokeLinejoin="miter" />
      </svg>
      <span className={`num relative mt-[22%] font-bold leading-none tracking-tight text-white ${text}`} style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.8)" }}>{label}</span>
    </span>
  );
}
