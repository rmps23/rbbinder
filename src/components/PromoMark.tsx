"use client";

import { printingKind } from "@/lib/setCollection";
import type { RiftCard } from "@/lib/types";

// A small holographic "PROMO" tag on promo printings (event, judge, bundle
// promos and Riot's SP cards), so they stand out from the regular card.
// Place it inside a `relative` box that holds the card art.
export function PromoMark({ card, size = "sm" }: { card: RiftCard; size?: "sm" | "md" }) {
  if (printingKind(card) !== "promo") return null;
  return (
    <span
      title="Promo printing"
      className={`promo-foil pointer-events-none absolute left-1/2 top-1.5 z-[5] -translate-x-1/2 rounded-[2px] font-display font-bold uppercase tracking-[0.18em] text-[#151821] shadow-[0_1px_6px_rgba(0,0,0,0.55)] ring-1 ring-white/60 ${
        size === "md" ? "px-2.5 py-0.5 text-[11px]" : "px-1.5 py-px text-[9px]"
      }`}
    >
      Promo
    </span>
  );
}
