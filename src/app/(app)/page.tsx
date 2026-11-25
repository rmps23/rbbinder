"use client";

import { domainColor, setColor, setRank } from "@/lib/style";
import { DashboardSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { useCardInspect } from "@/components/CardInspect";
import { CardArt } from "@/components/DeckViews";
import { CardImage } from "@/components/CardImage";
import { binderProgress } from "@/lib/binderProgress";
import { PriceModeSwitch } from "@/components/PriceModeSwitch";
import { typicalFinish } from "@/lib/cardFinish";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { isBaseCard } from "@/lib/setCollection";
import { useBinders } from "@/lib/useBinders";
import { valueBulk, valueContents } from "@/lib/valuation";
import { deckFamilies, hasVersions } from "@/lib/deckVersions";
import type { Deck, Match } from "@/lib/types";
import { WinRing } from "@/components/WinRing";
import { CountUp } from "@/components/CountUp";
import { Ruler } from "@/components/Ruler";
import { useGrown } from "@/lib/useGrown";
import { ResultDot } from "@/components/MatchRow";
import { pct, record, tally, winRate } from "@/lib/matchStats";


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
        <h2 className="flex items-center gap-2.5 font-display text-base font-semibold uppercase tracking-[0.08em] text-t1"><i aria-hidden="true" className="h-2 w-2 rotate-45 bg-brand-gold shadow-[0_0_8px_rgb(var(--accent)/0.7)]" />{title}</h2>
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

const hexRgb = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// A horizontal bar that fills up when it appears.
function GrowBar({ pct, className = "", style }: { pct: number; className?: string; style?: React.CSSProperties }) {
  const g = useGrown(Math.min(100, Math.max(0, pct)));
  return <div data-gfx="" className={`gfx-w h-full ${className}`} style={{ width: `${g}%`, ...style }} />;
}

// Wipes a child graphic in from the left.
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const g = useGrown(100);
  return (
    <div data-gfx="" className={`gfx-clip ${className}`} style={{ clipPath: `inset(0 ${100 - g}% 0 0 round 9999px)` }}>
      {children}
    </div>
  );
}

// The liquid in a hexagon rises to its level.
function HexFill({ pct }: { pct: number }) {
  const g = useGrown(pct);
  return <div data-gfx="" className="hex-fill absolute inset-x-0 bottom-0" style={{ height: `${Math.max(g, 4)}%` }} />;
}

export default function DashboardPage() {
  const inspect = useCardInspect();
  const { cards, sets, bulk, prices, priceOf, loading: appLoading } = useAppData();
  const { binders, loading: bindersLoading } = useBinders();
  const [decks, setDecks] = useState<Deck[]>([]);
  const families = useMemo(() => deckFamilies(decks), [decks]);

  const [matches, setMatches] = useState<Match[] | null>(null);
  useEffect(() => {
    fetch("/api/matches")
      .then((r) => (r.ok ? r.json() : []))
      .then((m) => setMatches(Array.isArray(m) ? m : []))
      .catch(() => setMatches([]));
  }, []);

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDecks)
      .catch(() => {});
  }, []);

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

  // The cards you have most copies of in the bulk pile, and how many spare copies that adds up to.
  const bulkInfo = useMemo(() => {
    const rows: { card: (typeof cards)[number]; qty: number; value: number | null }[] = [];
    let spare = 0;
    for (const [id, entry] of Object.entries(bulk)) {
      const card = cardById.get(id);
      if (!card) continue;
      const normal = entry.normal ?? 0;
      const foil = entry.foil ?? 0;
      const qty = normal + foil;
      if (qty <= 0) continue;
      spare += Math.max(0, qty - 1);
      const pn = normal ? priceOf(card, "normal") : 0;
      const pf = foil ? priceOf(card, "foil") : 0;
      rows.push({ card, qty, value: pn === null || pf === null ? null : pn * normal + pf * foil });
    }
    rows.sort((a, b) => b.qty - a.qty || (b.value ?? 0) - (a.value ?? 0));
    return { top: rows.slice(0, 5), spare };
  }, [bulk, cardById, priceOf]);

  const gameStats = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    return {
      total: tally(matches),
      first: tally(matches.filter((m) => m.summary.wentFirst === true)),
      second: tally(matches.filter((m) => m.summary.wentFirst === false)),
      last: matches.slice(0, 10),
    };
  }, [matches]);

  if (appLoading || bindersLoading) return <DashboardSkeleton />;

  const completion = stats.baseTotal ? stats.baseOwned / stats.baseTotal : 0;

  // The honeycomb scales with the number of sets: big hexagons for a handful, small ones for dozens.
  const nSets = stats.perSet.length;
  const hexW = nSets <= 6 ? 120 : nSets <= 15 ? 74 : 52;
  const hexK = nSets <= 6 ? 3 : nSets <= 15 ? 5 : 7;
  const hexH = Math.round(hexW * 1.1547);
  const rowSizes: number[] = [];
  for (let left = nSets, i = 0; left > 0; i++) {
    const n = Math.min(left, i % 2 === 0 ? hexK - 1 : hexK);
    rowSizes.push(n);
    left -= n;
  }

  return (
    <div className="dash flex flex-col gap-4 md:min-h-[calc(100dvh-3rem-4.5rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Dashboard</h1>
      </header>
      {cards.length === 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          ⚠ No cards yet. Open <Link href="/maintenance" className="underline">Data &amp; updates</Link> to fetch the official catalog.
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-12">
        {/* 01 value: open on the page, a big readout and a ruler */}
        <section className="relative flex flex-col justify-between gap-7 py-1 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-t3"><span className="mr-2 text-brand-gold">01</span>Collection value</p>
            <PriceModeSwitch />
          </div>
          <div>
            <p className="num whitespace-nowrap font-display text-7xl font-bold leading-none tracking-tight text-t1">
              {prices ? <CountUp value={stats.bindersValue + stats.bulkValue} format={formatEur} /> : "…"}
            </p>
            <p className="num mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-t3">
              <span>BINDERS <b className="ml-1 text-t1">{prices ? formatEur(stats.bindersValue) : "…"}</b></span>
              <span>BULK <b className="ml-1 text-t1">{prices ? formatEur(stats.bulkValue) : "…"}</b></span>
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between font-mono text-xs text-t3">
              <span className="uppercase tracking-[0.2em]">Collection</span>
              <span className="num"><b className="text-brand-gold"><CountUp value={completion * 100} />%</b> · <b className="text-t1">{stats.baseOwned}</b> / {stats.baseTotal}</span>
            </div>
            <Ruler pct={completion * 100} />
            <p className="num mt-4 font-mono text-xs text-t3">
              <b className="text-t1">{stats.copies}</b> CARDS · <b className="text-t1">{stats.owned}</b> UNIQUE · <b className="text-t1">{binders.length}</b> BINDERS · <b className="text-t1">{families.length}</b> DECKS
            </p>
          </div>
        </section>

        {/* sets: floating, no box */}
        <section className="relative flex flex-col items-center xl:col-span-5">
          <p className="mb-4 w-[400px] max-w-full font-mono text-[11px] uppercase tracking-[0.22em] text-t3"><span className="mr-2 text-brand-gold">02</span>Sets</p>
          {/* honeycomb: one hexagon per set, filled up to how much of it you own */}
          <div data-gfx="" className="mx-auto flex w-[400px] max-w-full flex-col items-center" role="group" aria-label="Completion per set">
            {(() => {
              let k = 0;
              return rowSizes.map((n, r) => (
                <div key={r} className="flex gap-1.5" style={{ marginTop: r > 0 ? -Math.round(hexH * 0.25) + 4 : 0 }}>
                  {stats.perSet.slice(k, (k += n)).map((s, hi) => {
                    const pct = s.total ? s.have / s.total : 0;
                    const c = setColor(s.id);
                    return (
                      <div key={s.id} className="hex gfx-rise group relative" title={`${s.name}: ${s.have}/${s.total}`} style={{ "--c": hexRgb(c), "--i": r * 3 + hi, width: hexW, height: hexH } as React.CSSProperties}>
                        <div className="hex-rim absolute inset-0" />
                        <div className="hex-body absolute inset-[2px] overflow-hidden">
                          <HexFill pct={pct * 100} />
                          <div className="relative flex h-full flex-col items-center justify-center">
                            <span className={`font-display font-semibold text-t1/90 ${hexW > 100 ? "text-[11px] tracking-[0.25em]" : hexW > 60 ? "text-[10px] tracking-widest" : "text-[9px] tracking-wider"}`}>{s.id}</span>
                            {hexW > 60 && (
                              <span className={`num font-display font-bold leading-none text-t1 ${hexW > 100 ? "text-2xl" : "text-base"}`}><CountUp value={pct * 100} duration={1300} /><span className="text-[0.55em] text-t1/70">%</span></span>
                            )}
                            {hexW > 100 && <span className="num mt-1 text-[10px] text-t1/70">{s.have}/{s.total}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </section>

        {/* a calm reading surface: no background pattern behind the text */}
        <div className="floor xl:col-span-12">
        <div className="grid xl:grid-cols-4 xl:divide-x xl:divide-[rgb(var(--line))]">
        {/* top cards: a podium, the best one big */}
        <section className="min-w-0 px-6 py-7 xl:first:pl-0 xl:last:pr-0">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-t2"><span className="mr-2 text-brand-gold">03</span>Most valuable</h2>
            <span aria-hidden="true" className="h-px flex-1 bg-[rgb(var(--track)/0.18)]" />
          </div>
          {stats.top.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">{prices ? "Add cards to see them here." : "Loading prices…"}</p>
          ) : (
            <div className="flex gap-4">
              <button type="button" onClick={() => inspect(stats.top[0].card)} title={`${displayName(stats.top[0].card)} - open details`} className="group relative w-[42%] shrink-0 text-left">
                <CardArt card={stats.top[0].card} sizes="260px" quality={90} className="rounded-lg shadow-[0_16px_36px_rgb(0_0_0/0.5)] transition group-hover:shadow-[0_16px_44px_rgb(255_255_255/0.12)]" />
                <span className="num absolute bottom-2 left-2 rounded-md bg-ink/85 px-2 py-0.5 font-display text-sm font-semibold text-t1 backdrop-blur-sm">{formatEur(stats.top[0].price)}</span>
              </button>
              <ol data-gfx="" className="flex min-w-0 flex-1 flex-col gap-5 pt-1">
                {stats.top.slice(1, 4).map(({ card, price }, i) => (
                  <li key={card.id} className="gfx-rise" style={{ "--i": i + 2 } as React.CSSProperties}>
                    <button type="button" onClick={() => inspect(card)} title={`${displayName(card)} - open details`} className="group flex w-full items-center gap-3 text-left">
                      <span className="num w-4 text-xs text-t3">{i + 2}</span>
                      <CardArt card={card} sizes="96px" quality={75} className="w-11 shrink-0 rounded" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-t1">{displayName(card)}</span>
                        <span className="num mt-0.5 block text-sm font-semibold text-t2">{formatEur(price)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* the cards you hold most copies of in the bulk */}
        <section className="min-w-0 px-6 py-7 xl:first:pl-0 xl:last:pr-0">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-t2"><span className="mr-2 text-brand-gold">04</span>Most in bulk</h2>
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
            <Link href="/bulk" className="text-xs font-semibold uppercase tracking-wider text-t3 transition hover:text-t1">All →</Link>
          </div>
          {bulkInfo.top.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">Your bulk is empty.</p>
          ) : (
            <>
              <ul data-gfx="" className="grid gap-3">
                {bulkInfo.top.map(({ card, qty, value }, i) => (
                  <li key={card.id} className="gfx-rise" style={{ "--i": i } as React.CSSProperties}>
                    <button type="button" onClick={() => inspect(card)} title={`${displayName(card)} - open details`} className="group flex w-full items-center gap-3 text-left">
                      <CardArt card={card} sizes="96px" quality={75} className="w-9 shrink-0 rounded" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{displayName(card)}</span>
                        <span className="num text-xs text-t3">{prices && value !== null ? formatEur(value) : card.publicCode}</span>
                      </span>
                      <span className="num font-display text-xl font-bold leading-none text-white">×<CountUp value={qty} duration={900} /></span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="num mt-4 border-t border-white/10 pt-3 text-xs text-t3">
                <b className="text-white">{bulkInfo.spare}</b> spare copies in your bulk
              </p>
            </>
          )}
        </section>

        {/* games */}
        <section className="min-w-0 px-6 py-7 xl:first:pl-0 xl:last:pr-0">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-t2"><span className="mr-2 text-brand-gold">05</span>Games</h2>
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
            <Link href="/matches" className="text-xs font-semibold uppercase tracking-wider text-t3 transition hover:text-t1">All →</Link>
          </div>
          {matches === null ? (
            <p className="py-6 text-sm text-t3">Loading…</p>
          ) : !gameStats ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">
              No games yet. <Link href="/matches" className="underline">Import a replay</Link>.
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-4">
                <WinRing rate={winRate(gameStats.total)} />
                <div>
                  <p className="num font-display text-2xl font-bold leading-none text-white">{record(gameStats.total)}</p>
                  <p className="num mt-1 text-xs text-t3">{gameStats.total.games} games</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-t3">Last {gameStats.last.length}</p>
                <div data-gfx="" className="flex flex-wrap gap-1.5">
                  {gameStats.last.map((m, i) => (
                    <span key={m.id} className="gfx-rise" style={{ "--i": i } as React.CSSProperties}>
                      <ResultDot result={m.result} title={`vs ${m.summary.opp.legend}`} />
                    </span>
                  ))}
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div>
                  <dd className="num font-display text-xl font-bold leading-none text-white">{(winRate(gameStats.first) ?? null) === null ? "–" : <><CountUp value={(winRate(gameStats.first) ?? 0) * 100} />%</>}</dd>
                  <dt className="num mt-1 text-xs text-t3">Going first · {record(gameStats.first)}</dt>
                </div>
                <div>
                  <dd className="num font-display text-xl font-bold leading-none text-white">{(winRate(gameStats.second) ?? null) === null ? "–" : <><CountUp value={(winRate(gameStats.second) ?? 0) * 100} />%</>}</dd>
                  <dt className="num mt-1 text-xs text-t3">Going second · {record(gameStats.second)}</dt>
                </div>
              </dl>
            </div>
          )}
        </section>

        {/* decks: wide image strips */}
        <section className="min-w-0 px-6 py-7 xl:first:pl-0 xl:last:pr-0">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-t2"><span className="mr-2 text-brand-gold">06</span>Decks</h2>
            <span aria-hidden="true" className="h-px flex-1 bg-[rgb(var(--track)/0.18)]" />
            <Link href="/decks" className="text-xs font-semibold uppercase tracking-wider text-t3 transition hover:text-t1">All →</Link>
          </div>
          {decks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-t3">
              No decks yet. <Link href="/decks" className="text-brand-gold underline">Build one</Link>.
            </p>
          ) : (
            <ul className="grid gap-3">
              {families.slice(0, 3).map((f) => {
                const d = f.latest;
                const legend = d.entries.find((e) => e.zone === "legend");
                const lc = legend && cardById.get(legend.cardId);
                return (
                  <li key={d.id}>
                    <Link href={`/decks/${d.id}`} className="tile group relative block h-20 overflow-hidden rounded-xl" style={{ "--tint": hexRgb(domainColor(lc?.domains?.[0]?.id)) } as React.CSSProperties}>
                      {lc?.image.url && (
                        <CardImage card={lc} fill sizes="480px" quality={90} className="object-cover object-[50%_20%] opacity-60 transition duration-500 group-hover:opacity-90" />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent" />
                      <span className="absolute inset-y-0 left-0 flex flex-col justify-center px-4">
                        <span className="block truncate font-display text-base font-semibold text-t1">
                          {d.name}
                          {hasVersions(f) && <span className="ml-1.5 text-t3">v{d.version}</span>}
                        </span>
                        <span className="block truncate text-xs text-t2">{lc ? displayName(lc) : "No legend yet"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </div>
        </div>
      </div>
    </div>
  );
}
