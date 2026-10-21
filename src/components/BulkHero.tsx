"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { BulkScanner } from "@/components/BulkScanner";
import { CardArt, primaryColor } from "@/components/DeckViews";
import { PriceModeSwitch } from "@/components/PriceModeSwitch";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { valueBulk } from "@/lib/valuation";

// Counts up (or down) to the new value instead of jumping.
function Money({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <>{formatEur(shown)}</>;
}

export function FoilShine() {
  return (
    <span
      className="pointer-events-none absolute inset-0 animate-shimmer mix-blend-overlay"
      style={{
        backgroundImage: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function BulkHero({ activeSet, onPickSet }: { activeSet: string; onPickSet: (id: string) => void }) {
  const { cards, sets, bulk, prices, priceOf } = useAppData();

  const data = useMemo(() => {
    const { total, bySet } = valueBulk(cards, bulk, priceOf);
    let foil = 0;
    let normal = 0;
    const top: { card: (typeof cards)[number]; price: number; foil: boolean }[] = [];
    for (const card of cards) {
      const e = bulk[card.id];
      if (!e) continue;
      normal += e.normal ?? 0;
      foil += e.foil ?? 0;
      for (const f of ["normal", "foil"] as const) {
        const price = (e[f] ?? 0) > 0 ? priceOf(card, f) : null;
        if (price !== null) top.push({ card, price, foil: f === "foil" });
      }
    }
    top.sort((a, b) => b.price - a.price);
    // one entry per card
    const seen = new Set<string>();
    const uniqueTop = top.filter((t) => (seen.has(t.card.id) ? false : (seen.add(t.card.id), true))).slice(0, 8);
    return { total, bySet, foil, normal, top: uniqueTop };
  }, [cards, bulk, priceOf]);

  const rows = sets.filter((s) => data.bySet.has(s.id)).map((s) => ({ id: s.id, ...data.bySet.get(s.id)! }));
  const biggest = Math.max(1, ...rows.map((r) => r.value));
  const empty = data.total.copies === 0;

  return (
    <div className="mb-6">
      {/* hero */}
      <div className="relative mb-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-panel p-5 sm:p-7">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-cyan via-brand-gold to-brand-cyan" />
        <span className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-cyan/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-white sm:text-4xl">Bulk</h1>
            <p className="mt-1 text-sm text-white/50">Duplicates and trade fodder - kept apart from your binders.</p>
            <div className="mt-3">
              <PriceModeSwitch />
            </div>
            {!empty && (
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="font-display text-4xl font-bold leading-none text-brand-gold sm:text-5xl">
                    {prices ? <Money value={data.total.value} /> : "…"}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">
                    Cardmarket{data.total.unpriced ? ` · ${data.total.unpriced} unpriced` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-white/70">
                    <b className="text-white">{data.total.copies}</b> cards
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-white/70">
                    <b className="text-white">{data.total.unique}</b> unique
                  </span>
                  <span className="rounded-full bg-brand-cyan/10 px-3 py-1.5 text-brand-cyan">
                    <b>{data.normal}</b> normal
                  </span>
                  <span className="rounded-full bg-foil/10 px-3 py-1.5 text-foil">
                    ✦ <b>{data.foil}</b> foil
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="[&_button]:h-12 [&_button]:px-6 [&_button]:text-sm [&_button]:shadow-[0_0_28px_-4px_rgb(var(--accent)/0.8)]">
            <BulkScanner />
          </div>
        </div>
        {empty && (
          <p className="relative mt-5 rounded-xl border border-dashed border-white/15 py-5 text-center text-sm text-white/45">
            Your bulk is empty. Hit <b className="text-brand-gold">Scan cards</b> and point the camera at a pile - or search below and tap +.
          </p>
        )}
      </div>

      {/* per expansion */}
      {rows.length > 0 && (
        <>
          <p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">By expansion - tap to filter</p>
          <div className="-mx-1 mb-4 flex gap-3 overflow-x-auto px-1 pb-3 pt-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((r) => {
              const on = activeSet === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPickSet(on ? "" : r.id)}
                  className={`group relative min-w-[150px] shrink-0 animate-card-in overflow-hidden rounded-2xl border p-3 text-left transition duration-200 hover:-translate-y-1 active:scale-95 ${
                    on ? "border-brand-gold bg-brand-gold/10 shadow-[0_0_24px_-6px_rgb(var(--accent)/0.6)]" : "border-white/[0.07] bg-panel hover:border-white/25"
                  }`}
                >
                  <span className="pointer-events-none absolute -right-3 -top-4 font-display text-6xl font-bold text-white/[0.05] transition group-hover:text-white/10">
                    {r.id}
                  </span>
                  <span className="relative block truncate text-[11px] font-semibold uppercase tracking-wide text-white/45">{r.name}</span>
                  <span className="relative block font-display text-xl font-semibold text-brand-gold">{formatEur(r.value)}</span>
                  <span className="relative block text-[11px] text-white/40">
                    {r.copies} card{r.copies === 1 ? "" : "s"} · {r.unique} unique
                  </span>
                  <span className="relative mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-cyan transition-all duration-700"
                      style={{ width: `${(r.value / biggest) * 100}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* jackpot cards */}
      {data.top.length > 0 && (
        <>
          <p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">💎 Jackpot cards</p>
          <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4 pt-3">
            {data.top.map(({ card, price, foil }, i) => (
              <div key={card.id} className="w-24 shrink-0 animate-card-in sm:w-28" style={{ animationDelay: `${i * 50}ms` }}>
                <div
                  className="relative overflow-hidden rounded-xl ring-2 ring-transparent transition duration-200 hover:-translate-y-1.5 hover:rotate-1 hover:ring-brand-gold/70"
                  style={{ boxShadow: `0 10px 24px -12px ${primaryColor(card)}` }}
                >
                  <CardArt card={card} sizes="120px" className="rounded-xl" />
                  {foil && <FoilShine />}
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gold font-display text-[11px] font-bold text-ink shadow">
                    {i + 1}
                  </span>
                  {foil && <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] text-foil">✦</span>}
                </div>
                <p className="mt-1 truncate text-[11px] text-white/65" title={displayName(card)}>{displayName(card)}</p>
                <p className="font-display text-sm font-semibold text-brand-gold">{formatEur(price)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
