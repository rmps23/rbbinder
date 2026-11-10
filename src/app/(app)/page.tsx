"use client";

import { DashboardSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { CardArt } from "@/components/DeckViews";
import { binderProgress } from "@/lib/binderProgress";
import { PriceModeSwitch } from "@/components/PriceModeSwitch";
import { typicalFinish } from "@/lib/cardFinish";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { isBaseCard } from "@/lib/setCollection";
import { useBinders } from "@/lib/useBinders";
import { valueBulk, valueContents } from "@/lib/valuation";
import type { CardsSyncResult, Deck } from "@/lib/types";


function MiniStat({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-lg bg-cavity/50 px-3 py-2.5 transition hover:bg-cavity">
      <p className="label">{label}</p>
      <p className="num mt-1 font-display text-xl font-bold leading-none text-t1">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-t3">{sub}</p>}
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

function Panel({ title, href, link, children, className = "" }: { title: string; href?: string; link?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-xl border border-line bg-panel p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold uppercase tracking-[0.08em] text-t1">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-3.5 font-display text-xs font-semibold uppercase tracking-wide text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1"
          >
            {link ?? "See all"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const btnBase = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-display text-xs font-semibold uppercase tracking-wide transition";
const btnGhost = `${btnBase} border border-line text-t2 hover:border-line2 hover:bg-panel2 hover:text-t1`;

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
        // one of each regular card - alt arts, overnumbered and showcase don't count
        const inSet = cards.filter((c) => c.set.id === s.id && isBaseCard(c));
        const have = inSet.filter((c) => owned.has(c.id)).length;
        return { id: s.id, name: s.name, have, total: inSet.length };
      })
      .filter((s) => s.total > 0);

    const top = [...unit.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, price]) => ({ card: cardById.get(id)!, price }));

    // The collection goal: one of each regular card of every set.
    const base = cards.filter(isBaseCard);
    const baseOwned = base.filter((c) => owned.has(c.id)).length;

    return { owned: owned.size, copies, bindersValue, bulkValue, perSet, top, baseOwned, baseTotal: base.length };
  }, [binders, bulk, cards, sets, cardById, priceOf, prices]);

  if (appLoading || bindersLoading) return <DashboardSkeleton />;

  const bindersByValue = [...binders]
    .map((b) => ({ b, v: valueContents(b.contents, cardById, priceOf).value }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const completion = stats.baseTotal ? stats.baseOwned / stats.baseTotal : 0;

  return (
    <div className="flex flex-col gap-4 md:min-h-[calc(100dvh-3rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/binders" className={btnGhost}>+ New binder</Link>
          <button onClick={syncCards} disabled={syncing} className={`${btnBase} btn-3d disabled:cursor-wait disabled:opacity-60`}>
            {syncing ? "Syncing..." : "Sync cards"}
          </button>
        </div>
      </header>
      {syncResult && <p role="status" className="text-sm text-ok">✓ {syncResult}</p>}
      {syncError && <p role="alert" className="text-sm text-bad">✕ {syncError}</p>}
      {cards.length === 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          ⚠ No cards yet. Click &quot;Sync cards&quot; to fetch the official catalog.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col justify-between rounded-xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 [&_*]:whitespace-nowrap">
            <div>
              <p className="label">Collection value</p>
              <p className="num mt-1.5 whitespace-nowrap text-3xl font-bold leading-none text-t1">
                {prices ? `${formatEur(stats.bindersValue + stats.bulkValue)}` : "…"}
              </p>
            </div>
            <PriceModeSwitch />
          </div>
          <p className="num mt-3 text-xs text-t3">
            Binders <b className="text-t2">{prices ? formatEur(stats.bindersValue) : "…"}</b> · Bulk{" "}
            <b className="text-t2">{prices ? formatEur(stats.bulkValue) : "…"}</b>
          </p>
        </section>

        <section className="flex items-center gap-5 rounded-xl border border-line bg-panel p-5">
          <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${Math.round(completion * 100)} percent of the collection completed`}>
            <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="24" cy="24" r="20" fill="none" className="stroke-cavity" strokeWidth="5" />
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
            <span className="num absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-t1">
              {Math.round(completion * 100)}%
            </span>
          </div>
          <div>
            <p className="label">Collected</p>
            <p className="num mt-1.5 whitespace-nowrap font-display text-3xl font-bold leading-none text-t1">
              {stats.baseOwned}
              <span className="text-t3"> / {stats.baseTotal}</span>
            </p>
            <p className="num mt-2 text-xs text-t3">
              {stats.copies} cards · {stats.owned} unique · {binders.length} binders · {decks.length} decks
            </p>
          </div>
        </section>
      </div>

      <div className="grid flex-[1.2] gap-4 md:grid-cols-2">
        <Panel title="Sets">
          <ul className="flex flex-1 flex-col justify-between gap-3">
            {stats.perSet.map((s) => {
              const pct = s.total ? s.have / s.total : 0;
              return (
                <li key={s.id} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3" title={s.name}>
                  <span className="font-display text-xs tracking-widest text-brand-gold">{s.id}</span>
                  <div className="h-2 overflow-hidden rounded-sm bg-cavity">
                    <div className="h-full rounded-sm bg-brand-gold" style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className="num w-24 text-right text-xs text-t3">
                    <b className="text-t1">{s.have}</b>/{s.total} · {Math.round(pct * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Top cards">
          {stats.top.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">
              {prices ? "Add cards to see them here." : "Loading prices…"}
            </p>
          ) : (
            <div className="grid flex-1 grid-cols-4 items-center gap-4">
              {stats.top.slice(0, 4).map(({ card, price }, i) => (
                <div key={card.id} title={displayName(card)}>
                  <div className="relative">
                    <CardArt card={card} sizes="(min-width: 1536px) 320px, 240px" quality={90} className="rounded-md" />
                    <span className="num absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded bg-warn px-1 text-[11px] font-bold text-ink">
                      {i + 1}
                    </span>
                  </div>
                  <p className="num mt-2 text-center font-display text-base font-semibold text-warn">{formatEur(price)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <Panel title="Top binders" href="/binders" link="All binders">
          {binders.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">
              No binders yet. <Link href="/binders" className="text-brand-gold underline">Create one</Link>.
            </p>
          ) : (
            <ul className="flex flex-1 flex-col justify-between gap-2">
              {bindersByValue.map(({ b, v }, idx) => {
                const prog = binderProgress(b, cards, sets);
                return (
                  <li key={b.id} className={idx > 2 ? "[@media(max-height:1000px)]:hidden" : ""}>
                    <Link
                      href={`/binder/${b.id}`}
                      className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg bg-cavity/40 px-3 py-2.5 transition hover:bg-cavity"
                    >
                      <span className="truncate text-sm font-semibold text-t1">
                        {b.setId && <span className="mr-2 font-display text-xs tracking-widest text-brand-gold">{b.setId}</span>}
                        {b.name}
                      </span>
                      <span className="num text-sm font-semibold text-t1">{prices ? `${formatEur(v)}` : "…"}</span>
                      <span className="col-span-2 flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-cavity">
                          <span className="block h-full rounded-sm bg-brand-gold" style={{ width: `${Math.min(100, prog.completion * 100)}%` }} />
                        </span>
                        <span className="num w-10 text-right text-xs text-t3">{Math.round(prog.completion * 100)}%</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent decks" href="/decks" link="All decks">
          {decks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">
              No decks yet. <Link href="/decks" className="text-brand-gold underline">Build one</Link>.
            </p>
          ) : (
            <ul className="flex flex-1 flex-col justify-between gap-2">
              {decks.slice(0, 4).map((d, idx) => {
                const legend = d.entries.find((e) => e.zone === "legend");
                const lc = legend && cardById.get(legend.cardId);
                return (
                  <li key={d.id} className={idx > 2 ? "[@media(max-height:1000px)]:hidden" : ""}>
                    <Link
                      href={`/decks/${d.id}`}
                      className="flex min-h-11 items-center gap-3 rounded-lg bg-cavity/40 px-3 py-2 transition hover:bg-cavity"
                    >
                      {lc ? (
                        <CardArt card={lc} sizes="96px" quality={90} className="w-9 shrink-0 rounded" />
                      ) : (
                        <div className="aspect-[744/1039] w-9 shrink-0 rounded border border-dashed border-line" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-semibold text-t1">{d.name}</span>
                        <span className="block truncate text-xs text-t3">{lc ? displayName(lc) : "No legend yet"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
