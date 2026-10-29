"use client";

import { useAppData } from "./AppDataProvider";
import type { PriceMode } from "@/lib/types";

const MODES: { id: PriceMode; label: string; hint: string }[] = [
  { id: "trend", label: "Trend", hint: "Cardmarket's price trend - what the card page shows." },
  { id: "avg7", label: "7-day avg", hint: "Average of the last 7 days of sales." },
  {
    id: "low",
    label: "Lowest",
    hint: "Cheapest listing on Cardmarket. Cardmarket doesn't publish this per language, so it can be a non-English copy and sit below the cheapest English one.",
  },
];

// Which Cardmarket figure every price on the site uses.
export function PriceModeSwitch() {
  const { priceMode, setPriceMode } = useAppData();
  return (
    <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.04] p-0.5" role="group" aria-label="Price basis">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          title={m.hint}
          onClick={() => setPriceMode(m.id)}
          aria-pressed={priceMode === m.id}
          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
            priceMode === m.id ? "bg-brand-gold text-ink" : "text-white/55 hover:text-white"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
