"use client";

import { useMemo } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { formatEur } from "@/lib/format";
import { valueBulk } from "@/lib/valuation";

// Total value of the bulk pile at English-market prices, plus each expansion's share.
export function BulkValue() {
  const { cards, sets, bulk, prices, priceOf } = useAppData();

  const result = useMemo(() => (prices ? valueBulk(cards, bulk, priceOf) : null), [cards, bulk, prices, priceOf]);

  if (!result || result.total.copies === 0) return null;
  const { total, bySet } = result;
  const rows = sets.filter((s) => bySet.has(s.id)).map((s) => ({ id: s.id, ...bySet.get(s.id)! }));

  return (
    <div className="mb-4">
      <p className="mb-3 text-sm text-white/60">
        Bulk value{" "}
        <span className="font-display text-xl font-semibold text-brand-gold">≈ {formatEur(total.value)}</span>{" "}
        <span className="text-white/40">
          for {total.copies} card{total.copies === 1 ? "" : "s"} ({total.unique} unique) · English market (TCGplayer)
          in euros
          {total.unpriced > 0 ? ` · ${total.unpriced} without a price` : ""}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {rows.map((r) => (
          <div key={r.id} className="relative animate-card-in overflow-hidden rounded-xl border border-white/[0.07] bg-panel px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-brand-gold/40">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-gold to-brand-cyan" />
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/45" title={r.name}>
              {r.name}
            </p>
            <p className="font-display text-xl font-semibold text-brand-gold">{formatEur(r.value)}</p>
            <p className="text-[11px] text-white/40">
              {r.copies} card{r.copies === 1 ? "" : "s"} · {r.unique} unique
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
