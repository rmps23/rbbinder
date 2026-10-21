"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { BinderCard, coverFor } from "@/components/BinderCard";
import { CardArt, primaryColor } from "@/components/DeckViews";
import { typicalFinish } from "@/lib/cardFinish";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { useBinders } from "@/lib/useBinders";
import { valueBulk, valueContents } from "@/lib/valuation";
import type { CardsSyncResult, Deck } from "@/lib/types";

function Stat({ label, value, sub, accent, href }: { label: string; value: string | number; sub?: string; accent: string; href?: string }) {
  const body = (
    <div className="relative h-full animate-card-in overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-4 transition duration-200 hover:-translate-y-1 hover:border-white/20 sm:p-5">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <p className="relative font-display text-2xl font-bold text-white sm:text-3xl">{value}</p>
      <p className="relative mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
      {sub && <p className="relative mt-0.5 text-[11px] text-white/30">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionTitle({ children, href, link }: { children: React.ReactNode; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="inline-block h-5 w-1 rounded-sm bg-gradient-to-b from-brand-gold to-brand-cyan" />
      <h2 className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-white">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      {href && (
        <Link href={href} className="text-xs font-semibold text-brand-gold hover:underline">
          {link ?? "See all"} →
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { cards, sets, bulk, prices, priceOf, loading: appLoading, reloadCards } = useAppData();
  const { binders, loading: bindersLoading } = useBinders();
  const [decks, setDecks] = useState<Deck[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDecks)
      .catch(() => {});
  }, []);

  async function syncCards() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/cards/sync", { method: "POST" });
      const data = (await res.json()) as CardsSyncResult | { error: string };
      if (!res.ok || !("ok" in data)) throw new Error("error" in data ? data.error : "Failed to sync");
      const parts = [`+${data.newCards} new card${data.newCards === 1 ? "" : "s"}`];
      if (data.newSets.length) parts.push(`new set(s): ${data.newSets.join(", ")}`);
      parts.push(`${data.totalCards} cards total`);
      setSyncResult(parts.join(" · "));
      reloadCards();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const stats = useMemo(() => {
    // Unique cards owned anywhere (a binder or the bulk pile), and the best price of each.
    const owned = new Set<string>();
    const unit = new Map<string, number>();
    const bump = (id: string, price: number | null) => {
      owned.add(id);
      if (price !== null && price > (unit.get(id) ?? 0)) unit.set(id, price);
    };
    let copies = 0;
    for (const b of binders) {
      for (const [id, qty] of Object.entries(b.contents ?? {})) {
        const card = cardById.get(id);
        if (!card) continue;
        copies += qty;
        bump(id, priceOf(card, typicalFinish(card)));
      }
    }
    for (const [id, entry] of Object.entries(bulk)) {
      const card = cardById.get(id);
      if (!card) continue;
      for (const f of ["normal", "foil"] as const) {
        if ((entry[f] ?? 0) > 0) {
          copies += entry[f];
          bump(id, priceOf(card, f));
        }
      }
    }
    const bindersValue = binders.reduce((n, b) => n + valueContents(b.contents, cardById, priceOf).value, 0);
    const bulkValue = prices ? valueBulk(cards, bulk, priceOf).total.value : 0;

    const perSet = sets
      .map((s) => {
        const inSet = cards.filter((c) => c.set.id === s.id);
        const have = inSet.filter((c) => owned.has(c.id)).length;
        return { id: s.id, name: s.name, have, total: inSet.length };
      })
      .filter((s) => s.total > 0);

    const top = [...unit.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, price]) => ({ card: cardById.get(id)!, price }));

    return { owned: owned.size, copies, bindersValue, bulkValue, perSet, top };
  }, [binders, bulk, cards, sets, cardById, priceOf, prices]);

  if (appLoading || bindersLoading) return <p className="py-10 text-center text-white/40">Loading collection...</p>;

  const completion = cards.length ? stats.owned / cards.length : 0;
  const bindersByValue = [...binders]
    .map((b) => ({ b, v: valueContents(b.contents, cardById, priceOf).value }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);

  return (
    <div>
      {/* hero */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-panel p-5 sm:p-7">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-gold via-brand-cyan to-brand-gold" />
        <span className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-brand-cyan/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-white sm:text-4xl">Dashboard</h1>
            <p className="mt-1 text-sm text-white/50">
              {prices ? (
                <>
                  Your collection is worth{" "}
                  <span className="font-display text-xl font-semibold text-brand-gold">
                    ≈ {formatEur(stats.bindersValue + stats.bulkValue)}
                  </span>{" "}
                  <span className="text-white/35">· English market (TCGplayer) in euros</span>
                </>
              ) : (
                "Your Riftbound collection at a glance."
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/binders" className="rounded-full border-[1.5px] border-brand-gold px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-brand-gold transition hover:bg-brand-gold/10 active:scale-95">
                + New binder
              </Link>
              <Link href="/bulk" className="rounded-full border border-white/15 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/5 active:scale-95">
                Scan to bulk
              </Link>
              <Link href="/decks" className="rounded-full border border-white/15 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/5 active:scale-95">
                Build a deck
              </Link>
              <button
                onClick={syncCards}
                disabled={syncing}
                className="rounded-full bg-brand-gold px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-ink shadow-[0_0_18px_-4px_rgb(var(--accent)/0.7)] transition hover:bg-brand-goldSoft active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                {syncing ? "Syncing..." : "Sync cards"}
              </button>
            </div>
            {syncResult && <p className="mt-2 text-sm text-emerald-300">{syncResult}</p>}
            {syncError && <p className="mt-2 text-sm text-red-300">{syncError}</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className="stroke-brand-gold"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - completion)}
                  style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold">
                {Math.round(completion * 100)}%
              </span>
            </div>
            <div className="text-sm">
              <p className="font-display text-2xl font-bold text-white">
                {stats.owned}
                <span className="text-white/35"> / {cards.length}</span>
              </p>
              <p className="text-[11px] uppercase tracking-wide text-white/40">unique cards collected</p>
            </div>
          </div>
        </div>
      </div>

      {cards.length === 0 && (
        <div className="mb-5 rounded-lg border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm text-brand-goldSoft">
          There are no cards in the database yet. Click &quot;Sync cards&quot; to fetch the official catalog.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Binders value" value={prices ? formatEur(stats.bindersValue) : "…"} accent="rgb(var(--accent))" href="/binders" />
        <Stat label="Bulk value" value={prices ? formatEur(stats.bulkValue) : "…"} accent="rgb(var(--mint))" href="/bulk" />
        <Stat label="Binders" value={binders.length} accent="#a35de0" href="/binders" />
        <Stat label="Decks" value={decks.length} accent="rgb(var(--danger))" href="/decks" />
        <Stat label="Cards owned" value={stats.copies} sub={`${stats.owned} unique`} accent="#3d7fe0" />
        <Stat label="In the catalog" value={cards.length} accent="#8b93a3" />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_1fr]">
        <section>
          <SectionTitle>Collection by set</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {stats.perSet.map((s) => {
              const pct = s.total ? s.have / s.total : 0;
              return (
                <div key={s.id} className="rounded-xl border border-white/[0.06] bg-panel px-4 py-3 transition hover:border-white/20">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-white">
                      <span className="mr-2 font-display text-[11px] tracking-widest text-brand-gold">{s.id}</span>
                      {s.name}
                    </span>
                    <span className="shrink-0 text-xs text-white/50">
                      <b className="text-white">{s.have}</b> / {s.total} · {Math.round(pct * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-cyan transition-all duration-700"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>Most valuable cards</SectionTitle>
          {stats.top.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/35">
              {prices ? "Add cards to your binders or bulk to see them here." : "Loading prices…"}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {stats.top.map(({ card, price }, i) => (
                <div key={card.id} className="animate-card-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <div
                    className="relative rounded-xl ring-2 ring-transparent transition hover:-translate-y-1.5 hover:ring-brand-gold/60"
                    style={{ boxShadow: `0 10px 26px -14px ${primaryColor(card)}` }}
                  >
                    <CardArt card={card} sizes="160px" className="rounded-xl" />
                    <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold font-display text-xs font-bold text-ink shadow-lg">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] text-white/70">{displayName(card)}</p>
                  <p className="font-display text-sm font-semibold text-brand-gold">{formatEur(price)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-10">
        <SectionTitle href="/binders" link="All binders">
          Top binders
        </SectionTitle>
        {binders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/35">
            No binders yet. <Link href="/binders" className="text-brand-gold underline">Create one</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bindersByValue.map(({ b, v }) => (
              <BinderCard key={b.id} binder={b} value={prices ? v : null} completion={cards.length ? b.uniqueCount / cards.length : 0} />
            ))}
          </div>
        )}
      </div>

      {decks.length > 0 && (
        <div className="mt-10">
          <SectionTitle href="/decks" link="All decks">
            Recent decks
          </SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.slice(0, 3).map((d) => {
              const legend = d.entries.find((e) => e.zone === "legend");
              const lc = legend && cardById.get(legend.cardId);
              const color = lc ? primaryColor(lc) : coverFor(d.id).glow;
              return (
                <Link
                  key={d.id}
                  href={`/decks/${d.id}`}
                  className="group relative flex animate-card-in items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-4 transition hover:-translate-y-1 hover:border-white/25"
                  style={{ boxShadow: `0 14px 36px -22px ${color}` }}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                  {lc ? (
                    <CardArt card={lc} sizes="64px" className="w-14 shrink-0 rounded-lg transition group-hover:-rotate-2 group-hover:scale-105" />
                  ) : (
                    <div className="aspect-[744/1039] w-14 shrink-0 rounded-lg border border-dashed border-white/15" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-display text-base font-semibold text-white">{d.name}</span>
                    <span className="block truncate text-xs text-white/45">{lc ? displayName(lc) : "No legend yet"}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
