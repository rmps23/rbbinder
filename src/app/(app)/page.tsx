"use client";

import { domainColor, setColor } from "@/lib/style";
import { DashboardSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { useCardInspect } from "@/components/CardInspect";
import { CardArt } from "@/components/DeckViews";
import { CardImage } from "@/components/CardImage";
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
import { useGrown } from "@/lib/useGrown";
import { ResultDot } from "@/components/MatchRow";
import { record, tally, winRate } from "@/lib/matchStats";


const hexRgb = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// A section title with an optional pill link, in the round-glass style.
function OrbHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center font-sans text-lg font-semibold tracking-tight text-white"><i aria-hidden="true" className="mr-3 inline-block h-5 w-[5px] -skew-x-[22deg] bg-[rgb(var(--accent))]" />{title}</h2>
      {href && (
        <Link href={href} className="orb-pill">
          {link ?? "Explore all"}
        </Link>
      )}
    </div>
  );
}

// A horizontal bar that fills up when it appears.
function GrowBar({ pct, className = "", style }: { pct: number; className?: string; style?: React.CSSProperties }) {
  const g = useGrown(Math.min(100, Math.max(0, pct)));
  return <div data-gfx="" className={`gfx-w h-full ${className}`} style={{ width: `${g}%`, ...style }} />;
}

// The liquid in a vial rises to its level, with a few bubbles drifting up through it.
function VialFill({ pct, height }: { pct: number; height: number }) {
  const g = useGrown(pct);
  const lift = Math.max(0, (height * Math.max(g, 4)) / 100 - 8);
  return (
    <div data-gfx="" className="hex-fill absolute inset-x-0 bottom-0" style={{ height: `${Math.max(g, 4)}%`, "--rise": `${lift}px` } as React.CSSProperties}>
      {pct > 10 &&
        [
          ["18%", 4, "0s", "3.4s"],
          ["44%", 3, "1.2s", "4.2s"],
          ["68%", 5, "2.3s", "3.8s"],
          ["82%", 3, "0.6s", "4.6s"],
        ].map(([left, size, delay, dur], i) => (
          <i key={i} className="bubble" style={{ left: left as string, width: size as number, height: size as number, animationDelay: delay as string, animationDuration: dur as string }} />
        ))}
    </div>
  );
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

  // only the five newest sets (perSet is in release order, so they are the last five)
  const recentSets = stats.perSet.slice(-5);

  const total = stats.bindersValue + stats.bulkValue;
  const spot = stats.top.slice(0, 4);
  const heroA = stats.top[0];
  const heroB = stats.top[1];

  return (
    <div className="orbit flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-t3">Your Riftbound collection at a glance</p>
        </div>
        <PriceModeSwitch />
      </header>
      {cards.length === 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          ⚠ No cards yet. Open <Link href="/maintenance" className="underline">Data &amp; updates</Link> to fetch the official catalog.
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-12">
        {/* ---- left column ---- */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* hero: the value, with the best cards floating beside it */}
          <section className="orb-card relative overflow-hidden p-7">
            <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-[rgb(var(--accent)/0.12)] blur-[80px]" aria-hidden="true" />
            <div className="relative max-w-[62%]">
              <p className="text-sm font-medium text-t2">Total collection value</p>
              <p className="num mt-2 font-sans text-6xl font-bold leading-none tracking-tight text-white">
                {prices ? <CountUp value={total} format={formatEur} /> : "…"}
              </p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-t3">
                <span>Binders <b className="num ml-1 text-white">{prices ? formatEur(stats.bindersValue) : "…"}</b></span>
                <span>Bulk <b className="num ml-1 text-white">{prices ? formatEur(stats.bulkValue) : "…"}</b></span>
              </p>
              <div className="mt-7">
                <div className="mb-2 flex items-baseline justify-between text-xs text-t3">
                  <span>Collection progress</span>
                  <span className="num"><b className="text-white"><CountUp value={completion * 100} />%</b> · {stats.baseOwned} / {stats.baseTotal}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-sm bg-white/10">
                  <GrowBar pct={completion * 100} className="rounded-sm bg-gradient-to-r from-[#ff7aa2] to-[#d11f5a] shadow-[0_0_16px_rgb(214_36_84/0.7)]" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  [stats.copies, "cards"],
                  [stats.owned, "unique"],
                  [binders.length, "binders"],
                  [families.length, "decks"],
                ].map(([n, l]) => (
                  <span key={String(l)} className="num rounded-md bg-white/[0.08] px-3 py-1 text-xs text-t2">
                    <b className="text-white">{n}</b> {l}
                  </span>
                ))}
              </div>
            </div>
            {heroA && (
              <div className="absolute right-6 top-1/2 hidden w-[44%] -translate-y-1/2 md:block" aria-hidden={false}>
                {heroB && (
                  <button type="button" onClick={() => inspect(heroB.card)} title={displayName(heroB.card)} className="absolute right-[26%] top-3 w-[38%] -rotate-[9deg] transition hover:-translate-y-1">
                    <CardArt card={heroB.card} sizes="200px" quality={75} className="rounded-xl shadow-[0_20px_44px_rgb(0_0_0/0.55)]" />
                  </button>
                )}
                <button type="button" onClick={() => inspect(heroA.card)} title={displayName(heroA.card)} className="relative ml-auto block w-[46%] rotate-[7deg] transition hover:-translate-y-1">
                  <CardArt card={heroA.card} sizes="240px" quality={80} className="rounded-xl shadow-[0_24px_54px_rgb(0_0_0/0.6)]" />
                  <span className="num absolute bottom-2 left-2 rounded-md bg-[rgb(var(--accent))] px-2.5 py-0.5 text-xs font-semibold text-white shadow-lg">{formatEur(heroA.price)}</span>
                </button>
              </div>
            )}
          </section>

          {/* spotlight: the most valuable cards */}
          <section>
            <OrbHead title="Most valuable" href="/bulk" link="Explore all" />
            {spot.length === 0 ? (
              <p className="orb-card p-6 text-center text-sm text-t3">{prices ? "Add cards to see them here." : "Loading prices…"}</p>
            ) : (
              <ul data-gfx="" className="grid grid-cols-2 gap-5 md:grid-cols-4">
                {spot.map(({ card, price }, i) => (
                  <li key={card.id} className="gfx-rise" style={{ "--i": i } as React.CSSProperties}>
                    <button
                      type="button"
                      onClick={() => inspect(card)}
                      title={`${displayName(card)} - open details`}
                      className="orb-art group relative block aspect-[744/1039] w-full overflow-hidden rounded-[4px] bg-black text-left"
                      style={{ "--c": hexRgb(setColor(card.set.id)) } as React.CSSProperties}
                    >
                      {card.image.url && <CardImage card={card} fill sizes="260px" quality={80} className="object-cover" />}
                      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
                      <span className="num absolute left-3 top-3 rounded-md bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">{formatEur(price)}</span>
                      <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-white">{displayName(card)}</span>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent))] text-white shadow-[0_6px_16px_rgb(214_36_84/0.6)] transition group-hover:bg-[rgb(var(--accent-soft))]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* most in bulk, as a table */}
          <section className="orb-card p-6">
            <OrbHead title="Most in bulk" href="/bulk" link="Open bulk" />
            {bulkInfo.top.length === 0 ? (
              <p className="py-4 text-center text-sm text-t3">Your bulk is empty.</p>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_5rem] gap-3 border-b border-white/10 px-1 pb-2 text-xs text-t3">
                  <span>Card</span>
                  <span className="text-right">Copies</span>
                  <span className="text-right">Value</span>
                  <span />
                </div>
                <ul data-gfx="" className="divide-y divide-white/[0.07]">
                  {bulkInfo.top.map(({ card, qty, value }, i) => (
                    <li key={card.id} className="gfx-rise grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_5rem] items-center gap-3 px-1 py-3" style={{ "--i": i } as React.CSSProperties}>
                      <span className="flex min-w-0 items-center gap-3">
                        <CardArt card={card} sizes="80px" quality={75} className="w-9 shrink-0 rounded-lg" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">{displayName(card)}</span>
                          <span className="num text-xs text-t3">{card.publicCode}</span>
                        </span>
                      </span>
                      <span className="num text-right font-sans text-base font-bold text-white">×<CountUp value={qty} duration={900} /></span>
                      <span className="num text-right text-sm text-t2">{prices && value !== null ? formatEur(value) : "–"}</span>
                      <button type="button" onClick={() => inspect(card)} className="orb-pill ml-auto !h-8 !px-3.5 text-xs">View</button>
                    </li>
                  ))}
                </ul>
                <p className="num mt-3 border-t border-white/10 pt-3 text-xs text-t3">
                  <b className="text-white">{bulkInfo.spare}</b> spare copies in your bulk
                </p>
              </>
            )}
          </section>
        </div>

        {/* ---- right column ---- */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-4">
          <section className="orb-cta relative overflow-hidden p-6">
            <i className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rotate-45 bg-white/10" aria-hidden="true" />
            <i className="pointer-events-none absolute -bottom-14 right-10 h-32 w-32 rotate-45 bg-white/10" aria-hidden="true" />
            <p className="relative text-sm font-medium text-white/80">Bulk</p>
            <h2 className="relative mt-1 font-sans text-2xl font-bold leading-tight text-white">Add cards to your bulk</h2>
            <p className="relative mt-2 text-sm text-white/75">Scan a pile with the camera and we add it for you.</p>
            <Link href="/bulk" className="relative mt-5 inline-flex h-11 items-center rounded-lg bg-white px-6 text-sm font-semibold text-[#8a1240] shadow-lg transition hover:bg-white/90">
              Scan cards
            </Link>
          </section>

          {/* sets: the 5 newest, as thin glass vials side by side */}
          <section className="orb-card p-6">
            <OrbHead title="Sets" href="/binders" link="All sets" />
            <div data-gfx="" className="grid grid-cols-5 items-end gap-2 py-2" role="group" aria-label="Completion per set">
              {recentSets.map((s, i) => {
                const pct = s.total ? s.have / s.total : 0;
                const c = setColor(s.id);
                const vh = 190;
                return (
                  <div key={s.id} className="gfx-rise flex flex-col items-center gap-2" title={`${s.name}: ${s.have}/${s.total}`} style={{ "--c": hexRgb(c), "--i": i } as React.CSSProperties}>
                    <span className="num font-sans text-sm font-bold leading-none text-white">
                      <CountUp value={pct * 100} duration={1300} />%
                    </span>
                    <div className="vial" style={{ width: 34, height: vh }}>
                      <VialFill pct={pct * 100} height={vh} />
                      <span className="vial-shine" />
                    </div>
                    <span className="font-display text-xs font-semibold tracking-widest" style={{ color: c }}>{s.id}</span>
                    <span className="num text-[10px] text-t3">{s.have}/{s.total}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* games */}
          <section className="orb-card p-6">
            <OrbHead title="Games" href="/matches" link="Explore all" />
            {matches === null ? (
              <p className="py-4 text-sm text-t3">Loading…</p>
            ) : !gameStats ? (
              <p className="py-4 text-center text-sm text-t3">
                No games yet. <Link href="/matches" className="underline">Import a replay</Link>.
              </p>
            ) : (
              <div>
                <div className="flex items-center gap-4">
                  <WinRing rate={winRate(gameStats.total)} />
                  <div>
                    <p className="num font-sans text-2xl font-bold leading-none text-white">{record(gameStats.total)}</p>
                    <p className="num mt-1 text-xs text-t3">{gameStats.total.games} games</p>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-xs text-t3">Last {gameStats.last.length}</p>
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
                    <dd className="num font-sans text-xl font-bold leading-none text-white">{winRate(gameStats.first) === null ? "–" : <><CountUp value={(winRate(gameStats.first) ?? 0) * 100} />%</>}</dd>
                    <dt className="num mt-1 text-xs text-t3">Going first · {record(gameStats.first)}</dt>
                  </div>
                  <div>
                    <dd className="num font-sans text-xl font-bold leading-none text-white">{winRate(gameStats.second) === null ? "–" : <><CountUp value={(winRate(gameStats.second) ?? 0) * 100} />%</>}</dd>
                    <dt className="num mt-1 text-xs text-t3">Going second · {record(gameStats.second)}</dt>
                  </div>
                </dl>
              </div>
            )}
          </section>

          {/* decks */}
          <section className="orb-card p-6">
            <OrbHead title="Decks" href="/decks" link="Explore all" />
            {decks.length === 0 ? (
              <p className="py-4 text-center text-sm text-t3">
                No decks yet. <Link href="/decks" className="underline">Build one</Link>.
              </p>
            ) : (
              <ul className="grid gap-3">
                {families.slice(0, 3).map((f) => {
                  const d = f.latest;
                  const legend = d.entries.find((e) => e.zone === "legend");
                  const lc = legend && cardById.get(legend.cardId);
                  return (
                    <li key={d.id}>
                      <Link href={`/decks/${d.id}`} className="group relative block h-20 overflow-hidden rounded-2xl ring-1 ring-white/10 transition hover:ring-white/30" style={{ "--c": hexRgb(domainColor(lc?.domains?.[0]?.id)) } as React.CSSProperties}>
                        {lc?.image.url && <CardImage card={lc} fill sizes="480px" quality={75} className="object-cover object-[50%_20%] opacity-70 transition duration-500 group-hover:opacity-100" />}
                        <span className="absolute inset-0 bg-gradient-to-r from-[#14060c] via-[#14060c]/60 to-transparent" />
                        <span className="absolute inset-y-0 left-0 flex flex-col justify-center px-4">
                          <span className="block truncate text-base font-semibold text-white">
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
  );
}
