"use client";

import Image from "next/image";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { domainColor } from "@/lib/style";
import type { DeckEntry, DeckZone, RiftCard } from "@/lib/types";

export type Row = { entry: DeckEntry; card: RiftCard };
export type Owned = "full" | "partial" | "none" | null;

export function primaryColor(card: RiftCard): string {
  return domainColor(card.domains[0]?.id);
}

export function CardArt({ card, sizes, className = "" }: { card: RiftCard; sizes: string; className?: string }) {
  return (
    <div className={`relative aspect-[744/1039] overflow-hidden bg-[#0a0c10] ${className}`}>
      {card.image.url ? (
        <Image src={card.image.url} alt={card.image.alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-white/40">{card.name}</span>
      )}
    </div>
  );
}

export function DomainDots({ card }: { card: RiftCard }) {
  return (
    <span className="inline-flex items-center gap-1">
      {card.domains.map((d) => (
        <span
          key={d.id}
          title={d.label}
          className="inline-block h-2 w-2 rounded-full ring-1 ring-black/40"
          style={{ background: domainColor(d.id) }}
        />
      ))}
    </span>
  );
}

const OWNED_STYLE: Record<Exclude<Owned, null>, { color: string; label: string }> = {
  full: { color: "#34d399", label: "All copies in your bulk" },
  partial: { color: "#fbbf24", label: "Only some copies in your bulk" },
  none: { color: "#ef4360", label: "Not in your bulk" },
};

export function OwnedDot({ owned }: { owned: Owned }) {
  if (!owned) return null;
  const s = OWNED_STYLE[owned];
  return (
    <span
      title={s.label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold"
      style={{ background: `${s.color}22`, color: s.color }}
    >
      {owned === "full" ? "✓" : owned === "partial" ? "½" : "✗"} bulk
    </span>
  );
}

function Pip({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "cyan" }) {
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
        tone === "gold" ? "bg-brand-gold text-ink" : "bg-brand-cyan text-ink"
      }`}
    >
      {children}
    </span>
  );
}
export { Pip };

// ---------- list ----------

export function ListView({
  zones,
  rowsByZone,
  countOf,
  ownedOf,
  onAdjust,
  onMove,
}: {
  zones: { id: DeckZone; label: string; target: number | null; max: number | null }[];
  rowsByZone: Map<DeckZone, Row[]>;
  countOf: (z: DeckZone) => number;
  ownedOf: (card: RiftCard) => Owned;
  onAdjust: (row: Row, delta: number) => void;
  onMove: (row: Row, to: DeckZone) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {zones.map((zone) => {
        const rows = rowsByZone.get(zone.id) ?? [];
        const count = countOf(zone.id);
        const goal = zone.target ?? zone.max;
        const done = zone.target !== null && count >= zone.target;
        return (
          <section key={zone.id}>
            <h3 className="mb-2 flex items-center justify-between font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              {zone.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] tracking-normal ${
                  done ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-white/50"
                }`}
              >
                {count}
                {goal ? ` / ${goal}` : ""}
              </span>
            </h3>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 py-3 text-center text-xs text-white/25">
                Nothing here yet
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rows.map((row) => {
                  const { entry, card } = row;
                  const color = primaryColor(card);
                  return (
                    <li
                      key={`${entry.zone}:${entry.cardId}`}
                      className="group relative flex animate-card-in items-center gap-2 overflow-hidden rounded-xl border border-white/[0.07] bg-panel2 p-1.5 transition hover:border-white/20"
                    >
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                      <CardArt card={card} sizes="48px" className="ml-1 w-11 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-white">{displayName(card)}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                          {card.energy !== null && <Pip>{card.energy}</Pip>}
                          <DomainDots card={card} />
                          <OwnedDot owned={ownedOf(card)} />
                        </span>
                        <span className="mt-0.5 flex gap-1 opacity-60 transition group-hover:opacity-100">
                          {entry.zone === "main" && card.types.includes("unit") && (
                            <button
                              type="button"
                              onClick={() => onMove(row, "champion")}
                              className="rounded bg-white/5 px-1.5 text-[10px] hover:bg-brand-gold hover:text-ink"
                              title="Make this your champion"
                            >
                              ★ Champion
                            </button>
                          )}
                          {entry.zone === "main" && (
                            <button
                              type="button"
                              onClick={() => onMove(row, "sideboard")}
                              className="rounded bg-white/5 px-1.5 text-[10px] hover:bg-white/20"
                            >
                              → Side
                            </button>
                          )}
                          {(entry.zone === "sideboard" || entry.zone === "champion") && (
                            <button
                              type="button"
                              onClick={() => onMove(row, "main")}
                              className="rounded bg-white/5 px-1.5 text-[10px] hover:bg-white/20"
                            >
                              → Main
                            </button>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-center">
                        <button
                          type="button"
                          aria-label="Add one"
                          onClick={() => onAdjust(row, 1)}
                          className="flex h-6 w-7 items-center justify-center rounded-t-md bg-white/5 text-sm hover:bg-brand-gold hover:text-ink active:scale-95"
                        >
                          +
                        </button>
                        <span key={entry.qty} className="animate-pop py-0.5 font-display text-lg font-bold leading-none text-brand-gold">
                          {entry.qty}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove one"
                          onClick={() => onAdjust(row, -1)}
                          className="flex h-6 w-7 items-center justify-center rounded-b-md bg-white/5 text-sm hover:bg-brand-red hover:text-white active:scale-95"
                        >
                          −
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------- full art ----------

export function ArtView({
  zones,
  rowsByZone,
  onAdjust,
}: {
  zones: { id: DeckZone; label: string }[];
  rowsByZone: Map<DeckZone, Row[]>;
  onAdjust: (row: Row, delta: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {zones.map((zone) => {
        const rows = rowsByZone.get(zone.id) ?? [];
        if (!rows.length) return null;
        return (
          <section key={zone.id}>
            <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{zone.label}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {rows.map((row) => (
                <div key={`${row.entry.zone}:${row.entry.cardId}`} className="group relative animate-card-in">
                  <button
                    type="button"
                    onClick={() => onAdjust(row, 1)}
                    className="block w-full rounded-lg ring-2 ring-transparent transition hover:-translate-y-1 hover:ring-brand-gold/70"
                    style={{ boxShadow: `0 6px 18px -8px ${primaryColor(row.card)}` }}
                  >
                    <CardArt card={row.card} sizes="120px" className="rounded-lg" />
                  </button>
                  <span
                    key={row.entry.qty}
                    className="absolute -right-1 -top-1 flex h-6 min-w-6 animate-pop items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-bold text-ink shadow-lg"
                  >
                    ×{row.entry.qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove one"
                    onClick={() => onAdjust(row, -1)}
                    className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm opacity-0 transition hover:bg-brand-red group-hover:opacity-100"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- stats ----------

export function StatsView({ rows }: { rows: Row[] }) {
  // Everything that goes into the 40 (main + champion), runes/battlefields aside.
  const playable = rows.filter((r) => r.entry.zone === "main" || r.entry.zone === "champion");
  const curve = Array.from({ length: 8 }, () => 0);
  const domains = new Map<string, number>();
  const types = new Map<string, number>();
  let energyTotal = 0;
  let energyCount = 0;
  for (const { entry, card } of playable) {
    const q = entry.qty;
    for (const t of card.types) types.set(t, (types.get(t) ?? 0) + q);
    for (const d of card.domains) domains.set(d.id, (domains.get(d.id) ?? 0) + q);
    if (card.energy !== null) {
      curve[Math.min(7, card.energy)] += q;
      energyTotal += card.energy * q;
      energyCount += q;
    }
  }
  const peak = Math.max(1, ...curve);
  const total = playable.reduce((n, r) => n + r.entry.qty, 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-white/[0.07] bg-panel2 p-4">
        <h3 className="mb-3 flex items-baseline justify-between font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Energy curve
          <span className="text-[11px] normal-case tracking-normal text-white/40">
            avg {energyCount ? (energyTotal / energyCount).toFixed(1) : "–"}
          </span>
        </h3>
        <div className="flex h-36 items-end gap-2">
          {curve.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] text-white/50">{n || ""}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-brand-gold/60 to-brand-gold transition-all duration-500"
                style={{ height: `${(n / peak) * 100}%`, minHeight: n ? 4 : 0 }}
              />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                {i === 7 ? "7+" : i}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-panel2 p-4">
        <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Colours</h3>
        {[...domains].length === 0 ? (
          <p className="text-xs text-white/30">No cards yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...domains].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <div key={id} className="flex items-center gap-2 text-xs">
                <span className="w-16 capitalize text-white/60">{id}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(n / Math.max(1, total)) * 100}%`, background: domainColor(id) }}
                  />
                </div>
                <span className="w-6 text-right text-white/50">{n}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-panel2 p-4">
        <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Card types</h3>
        <div className="flex flex-wrap gap-2">
          {[...types].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-white/70">
              {t} <b className="text-brand-gold">{n}</b>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------- bulk comparison ----------

export type CompareData = {
  have: { key: string; card: RiftCard; qty: number; needed: number }[];
  missing: { key: string; card: RiftCard; qty: number; price: number | null }[];
  missingCost: number;
  missingUnpriced: number;
  totalNeeded: number;
  totalHave: number;
};

export function BulkView({
  compare,
  hasCards,
  includeRunes,
  onIncludeRunes,
}: {
  compare: CompareData;
  hasCards: boolean;
  includeRunes: boolean;
  onIncludeRunes: (v: boolean) => void;
}) {
  const pct = compare.totalNeeded ? Math.round((compare.totalHave / compare.totalNeeded) * 100) : 0;
  const list = (cls: string) => `flex flex-col gap-1.5 ${cls}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-white/[0.07] bg-panel2 p-4">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl font-bold">
            <span className="text-brand-cyan">{compare.totalHave}</span>
            <span className="text-white/35"> / {compare.totalNeeded}</span>
          </p>
          <span className="font-display text-xl text-white/60">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-emerald-300 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">cards you already have in bulk</p>
        {compare.missing.length > 0 && (
          <p className="mt-3 text-sm text-white/60">
            To complete it <span className="font-display text-lg font-semibold text-brand-gold">≈ {formatEur(compare.missingCost)}</span>
            <span className="block text-[11px] text-white/35">
              cheapest English-market printing (TCGplayer){compare.missingUnpriced ? ` · ${compare.missingUnpriced} without a price` : ""}
            </span>
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-white/50">
          <input type="checkbox" checked={includeRunes} onChange={(e) => onIncludeRunes(e.target.checked)} />
          Include runes
        </label>
      </div>

      <section>
        <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan">From your bulk</h3>
        {compare.have.length === 0 ? (
          <p className="text-xs text-white/30">Nothing from the deck is in your bulk.</p>
        ) : (
          <ul className={list("")}>
            {compare.have.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5 rounded-lg bg-panel2 p-1.5 ring-1 ring-inset ring-brand-cyan/15">
                <CardArt card={r.card} sizes="40px" className="w-9 shrink-0 rounded" />
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">{displayName(r.card)}</span>
                <span className="shrink-0 pr-1 font-display text-base font-bold text-brand-cyan">
                  {r.qty}
                  {r.qty < r.needed && <span className="text-white/35"> / {r.needed}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-red">Missing</h3>
        {compare.missing.length === 0 ? (
          <p className="text-xs text-white/30">{hasCards ? "You have everything. Time to sleeve up!" : "Add cards to the deck."}</p>
        ) : (
          <ul className={list("")}>
            {compare.missing.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5 rounded-lg bg-panel2 p-1.5 ring-1 ring-inset ring-brand-red/15">
                <CardArt card={r.card} sizes="40px" className="w-9 shrink-0 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/90">{displayName(r.card)}</span>
                  {r.price !== null && <span className="text-[11px] text-white/40">from {formatEur(r.price)}</span>}
                </span>
                <span className="shrink-0 pr-1 font-display text-base font-bold text-brand-red">×{r.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- rules checklist ----------

export function RulesPanel({
  checks,
  problems,
  legal,
  stale,
}: {
  checks: { id: string; label: string; detail: string; ok: boolean }[];
  problems: string[];
  legal: boolean;
  stale: boolean;
}) {
  return (
    <details className="group mb-4 rounded-xl border border-white/[0.07] bg-panel2" open={!legal}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Deck rules</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            legal ? "bg-emerald-400/15 text-emerald-300" : "bg-brand-gold/15 text-brand-goldSoft"
          }`}
        >
          {legal ? "✓ Legal" : `${checks.filter((c) => !c.ok).length} to fix`}
        </span>
      </summary>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 pb-3 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={`mt-px ${c.ok ? "text-emerald-300" : "text-white/30"}`}>{c.ok ? "✓" : "○"}</span>
            <span className={`flex-1 ${c.ok ? "text-white/60" : "text-white/85"}`}>{c.label}</span>
            <span className={c.ok ? "text-white/30" : "text-brand-gold"}>{c.detail}</span>
          </li>
        ))}
      </ul>
      {problems.length > 0 && (
        <ul className="border-t border-white/[0.06] px-3 py-2 text-xs text-brand-red">
          {problems.slice(0, 6).map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
          {problems.length > 6 && <li>…and {problems.length - 6} more</li>}
        </ul>
      )}
      {stale && (
        <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] text-white/40">
          Press “Sync cards” on the dashboard once to load champion and signature data - until then those two rules aren&apos;t checked.
        </p>
      )}
    </details>
  );
}
