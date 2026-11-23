// A win rate as a ring with the figure in the middle. The stroke is thin and the
// text small for the size, so even "100%" keeps clear space around it.
const SIZES = {
  sm: { box: 60, stroke: 4, text: "text-[13px]" },
  lg: { box: 136, stroke: 8, text: "text-[32px]" },
};

export function WinRing({ rate, size = "sm" }: { rate: number | null; size?: keyof typeof SIZES }) {
  const { box, stroke, text } = SIZES[size];
  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const label = rate === null ? "–" : `${Math.round(rate * 100)}%`;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: box, height: box }} role="img" aria-label={rate === null ? "No decided games" : `${label} win rate`}>
      <svg viewBox={`0 0 ${box} ${box}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-cavity" />
        {rate !== null && rate > 0 && (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - rate)}
            className={rate >= 0.5 ? "stroke-ok" : "stroke-bad"}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        )}
      </svg>
      <span className={`num font-bold leading-none tracking-tight text-t1 ${text}`}>{label}</span>
    </span>
  );
}
