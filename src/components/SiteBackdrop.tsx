// Site background: fine, flowing contour lines (like a topographic map), with a few lines picking up the set colours.
// Fixed behind everything; fades out towards the bottom so lists stay easy to read. Still on purpose: moving, it made
// the whole page be drawn again on every frame.
const W = 1600;
const H = 900;
const LINES = 24;
const TINTS = ["#C6F135", "#E8386F", "#6EC6F2", "#4A78D6"]; // signal lime, Vendetta, Radiance, Origins

function line(i: number): string {
  const y0 = 30 + (i * (H - 60)) / (LINES - 1);
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 20) {
    const t = (x / W) * Math.PI * 2;
    const y = y0 + 34 * Math.sin(t * 2 + i * 0.17) + 15 * Math.sin(t * 5 + i * 0.33 + 1.3) + 6 * Math.sin(t * 9 + i * 0.5);
    pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function SiteBackdrop() {
  return (
    <div aria-hidden="true" className="site-backdrop">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="site-backdrop-lines">
        <defs>
          <linearGradient id="site-line" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {Array.from({ length: LINES }, (_, i) => {
          const tinted = i % 6 === 3;
          return (
            <path
              key={i}
              d={line(i)}
              fill="none"
              stroke={tinted ? TINTS[(i / 6) | 0] : "url(#site-line)"}
              strokeWidth={tinted ? 1.4 : 1}
              strokeOpacity={tinted ? 0.34 : 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
