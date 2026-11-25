"use client";

import { useGrown } from "@/lib/useGrown";

// A graduated gauge whose ticks light up in sequence: the site's progress indicator.
// `pct` is 0-100. `color` is any CSS colour (defaults to the accent).
export function Ruler({ pct, ticks = 60, className = "h-8", color = "rgb(var(--accent))" }: { pct: number; ticks?: number; className?: string; color?: string }) {
  const g = useGrown(Math.min(100, Math.max(0, pct)));
  return (
    <div data-gfx="" aria-hidden="true" className={`flex items-end gap-[3px] ${className}`}>
      {Array.from({ length: ticks }, (_, i) => {
        const on = ((i + 0.5) / ticks) * 100 <= g;
        return (
          <span
            key={i}
            className="flex-1 transition-colors duration-300"
            style={{
              height: i % 5 === 0 ? "100%" : "52%",
              background: on ? color : "rgb(var(--track) / 0.2)",
              transitionDelay: `${Math.min(i * 14, 900)}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
