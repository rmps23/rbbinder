"use client";

import { useEffect, useRef, useState } from "react";

// Points after each turn, you against the opponent. Two series, so the lines
// also differ in dash and carry a legend - never colour alone.
const ME = "#2FA3C4";
const OPP = "#B5760F";
const H = 150;
const PAD = { l: 26, r: 14, t: 10, b: 22 };

export function ScoreChart({ scores, me, opp }: { scores: { turn: number; me: number; opp: number }[]; me: string; opp: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // drawn at its real width, so the labels keep their size on a phone
  const [W, setW] = useState(640);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(8, ...scores.flatMap((p) => [p.me, p.opp]));
  const step = (W - PAD.l - PAD.r) / Math.max(1, scores.length - 1);
  const x = (i: number) => PAD.l + i * step;
  const y = (v: number) => H - PAD.b - (v * (H - PAD.t - PAD.b)) / max;
  // steps: a score holds until the next turn changes it
  const path = (k: "me" | "opp") => scores.map((p, i) => (i ? `H${x(i)}V${y(p[k])}` : `M${x(0)},${y(p[k])}`)).join("");
  const at = hover ?? scores.length - 1;
  const point = scores[at];
  const final = scores[scores.length - 1];

  return (
    <figure ref={box} className="rounded-lg border border-line bg-ink p-3">
      <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t2">
        <span className="label">Score by turn</span>
        <span className="num flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <path d="M0 2h18" stroke={ME} strokeWidth="2" />
          </svg>
          {me} <b className="text-t1">{point.me}</b>
        </span>
        <span className="num flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <path d="M0 2h18" stroke={OPP} strokeWidth="2" strokeDasharray="5 3" />
          </svg>
          {opp} <b className="text-t1">{point.opp}</b>
        </span>
        <span className="num text-t3">{hover === null ? "Final" : `Turn ${point.turn}`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Score by turn. Final: ${me} ${final.me}, ${opp} ${final.opp}`} onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <path d={`M${PAD.l},${y(v)}H${W - PAD.r}`} className="stroke-line" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" className="num fill-t3 text-[10px]">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {scores.map((p, i) => (
          <text key={p.turn} x={x(i)} y={H - 6} textAnchor="middle" className="num fill-t3 text-[10px]">
            {step >= 18 || i % 2 === 0 ? p.turn : ""}
          </text>
        ))}
        {hover !== null && <path d={`M${x(hover)},${PAD.t}V${H - PAD.b}`} className="stroke-line2" strokeWidth="1" />}
        <path d={path("opp")} fill="none" stroke={OPP} strokeWidth="2" strokeDasharray="5 3" />
        <path d={path("me")} fill="none" stroke={ME} strokeWidth="2" />
        <circle cx={x(at)} cy={y(point.opp)} r="4" fill={OPP} className="stroke-ink" strokeWidth="2" />
        <circle cx={x(at)} cy={y(point.me)} r="4" fill={ME} className="stroke-ink" strokeWidth="2" />
        {scores.map((p, i) => (
          <rect key={p.turn} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
    </figure>
  );
}
