"use client";

import { SlideGroup } from "@/components/SlideGroup";
import { useAppData } from "./AppDataProvider";
import type { PriceMode } from "@/lib/types";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const MODES: { id: PriceMode; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: "trend",
    label: "Trend",
    hint: "Trend - Cardmarket's price trend, what the card page shows.",
    icon: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  },
  {
    id: "avg7",
    label: "7-day average",
    hint: "7-day average - average of the last 7 days of sales.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    id: "low",
    label: "Lowest",
    hint:
      "Lowest - cheapest listing on Cardmarket. Cardmarket doesn't publish this per language, so it can be a non-English copy and sit below the cheapest English one.",
    icon: <path d="M12 4v14m-6-6 6 6 6-6M5 21h14" />,
  },
];

// Which Cardmarket figure every price on the site uses.
export function PriceModeSwitch() {
  const { priceMode, setPriceMode } = useAppData();
  return (
    <SlideGroup className="flex h-11 items-stretch gap-0.5 rounded-lg border border-line bg-ink p-0.5" role="radiogroup" aria-label="Price basis">
      {MODES.map((m) => {
        const on = priceMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            data-active={on}
            aria-checked={on}
            aria-label={m.label}
            title={m.hint}
            onClick={() => setPriceMode(m.id)}
            className={`flex w-11 items-center justify-center rounded-md transition ${
              on ? "text-on-accent" : "text-t2 hover:text-t1"
            }`}
          >
            <svg viewBox="0 0 24 24" {...ICON} className="h-[18px] w-[18px]" aria-hidden="true">
              {m.icon}
            </svg>
          </button>
        );
      })}
    </SlideGroup>
  );
}
