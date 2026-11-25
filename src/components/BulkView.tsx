"use client";

import { setColor } from "@/lib/style";
import { PROMO_SET_IDS } from "@/lib/setCollection";
import { isFoilOnly } from "@/lib/cardFinish";
import { FoilSheen } from "@/components/FoilSheen";
import { SlideGroup } from "@/components/SlideGroup";
import { PromoMark } from "@/components/PromoMark";
import { BulkSkeleton } from "@/components/Skeletons";
import { CardImage } from "@/components/CardImage";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { BulkScanner } from "@/components/BulkScanner";
import { CardDetailModal } from "@/components/CardDetailModal";
import { PriceModeSwitch } from "@/components/PriceModeSwitch";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Select } from "@/components/Select";
import { availableFinishes } from "@/lib/cardFinish";
import { isAlternateArt } from "@/lib/cardUtils";
import { DOMAIN_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import { CountUp } from "@/components/CountUp";
import { rarityColor } from "@/lib/style";
import { valueBulk } from "@/lib/valuation";
import type { RiftCard } from "@/lib/types";

// Proving Grounds isn't tracked for bulk/trades.
const EXCLUDED_SETS = new Set(["OGS"]);
// Booster sets get their own tab; promo and bundle sets (OPP, PR, JDG, RWB, SGN, T12025, RXKDA, ARC...) go under "Others".
const OTHERS = "__others";
const isMainSet = (id: string) => !PROMO_SET_IDS.has(id) && id !== "ARC";
const ROWS_PER_PAGE = 60;

type AltArt = "all" | "hide" | "only";

const ART_OPTIONS = [
  { value: "all", label: "All art" },
  { value: "hide", label: "Regular art" },
  { value: "only", label: "Alt art" },
];

function CardTile({
  card,
  normalQty,
  foilQty,
  onInspect,
}: {
  card: RiftCard;
  normalQty: number;
  foilQty: number;
  onInspect: () => void;
}) {
  const { priceOf, setBulkQty } = useAppData();
  const finishes = availableFinishes(card);
  // only offer the finishes the card exists in - but never hide one you already own
  const showNormal = finishes.normal || normalQty > 0;
  const showFoil = finishes.foil || foilQty > 0;
  const normalPrice = showNormal ? priceOf(card, "normal") : null;
  const foilPrice = showFoil ? priceOf(card, "foil") : null;
  const owned = normalQty > 0 || foilQty > 0;

  const qty = normalQty + foilQty;

  return (
    <li className="group flex flex-col gap-2.5">
      <button
        type="button"
        onClick={onInspect}
        aria-label={`${card.name}, open details`}
        className={`relative block aspect-[744/1039] w-full overflow-hidden rounded-xl bg-ink ring-1 transition duration-300 ${
          owned ? "ring-white/25 shadow-[0_10px_30px_rgb(0_0_0/0.45)] group-hover:ring-white/50" : "ring-white/10 group-hover:ring-white/30"
        }`}
      >
        {card.image.url && (
          <CardImage
            card={card}
            alt=""
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1280px) 22vw, 15vw"
            quality={90}
            className={`object-cover transition duration-300 ${owned ? "" : "opacity-45 group-hover:opacity-90"}`}
          />
        )}
        {(foilQty > 0 || isFoilOnly(card)) && <FoilSheen />}
        <PromoMark card={card} />
        {owned && (
          <span className="num absolute right-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">×{qty}</span>
        )}
      </button>

      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold text-t1" title={card.name}>
          {card.name}
        </p>
        <p className="num mt-0.5 flex items-center gap-1.5 text-xs text-t3">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: rarityColor(card.rarity?.id) }} aria-hidden="true" />
          {card.publicCode}
        </p>
      </div>

      <div className="mt-auto grid gap-1.5 rounded-lg bg-[rgb(var(--track)/0.07)] p-2">
        {showNormal && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] leading-tight text-t3">
              {showFoil ? "Normal" : "Normal only"}
              <span className="num block text-xs font-semibold text-t1">{normalPrice !== null ? formatEur(normalPrice) : "–"}</span>
            </span>
            <QuantityStepper compact value={normalQty} onChange={(q) => setBulkQty(card.id, "normal", q)} accent="cyan" />
          </div>
        )}
        {showFoil && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] leading-tight text-t3">
              {showNormal ? "✦ Foil" : "✦ Foil only"}
              <span className="num block text-xs font-semibold text-t1">{foilPrice !== null ? formatEur(foilPrice) : "–"}</span>
            </span>
            <QuantityStepper compact value={foilQty} onChange={(q) => setBulkQty(card.id, "foil", q)} accent="gold" />
          </div>
        )}
      </div>
    </li>
  );
}

export function BulkView() {
  const { cards, sets, bulk, prices, priceOf, loading } = useAppData();

  const [search, setSearch] = useState("");
  const [setId, setSetId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [rarityId, setRarityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [altArt, setAltArt] = useState<AltArt>("all");
  const [onlyOwned, setOnlyOwned] = useState(true);
  // phones: the selects and switch fold away behind a "Filters" button
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(ROWS_PER_PAGE);
  const [inspect, setInspect] = useState<RiftCard | null>(null);

  const availableCards = useMemo(() => cards.filter((c) => !EXCLUDED_SETS.has(c.set.id)), [cards]);
  const availableSets = useMemo(() => sets.filter((s) => !EXCLUDED_SETS.has(s.id) && isMainSet(s.id)), [sets]);

  const stats = useMemo(() => {
    const { total, bySet } = valueBulk(cards, bulk, priceOf);
    let normal = 0;
    let foil = 0;
    for (const e of Object.values(bulk)) {
      normal += e.normal ?? 0;
      foil += e.foil ?? 0;
    }
    // value and copies of everything outside the booster sets
    let othersValue = 0;
    let othersCopies = 0;
    for (const [sid, v] of bySet) if (!isMainSet(sid) && !EXCLUDED_SETS.has(sid)) {
      othersValue += v.value;
      othersCopies += v.copies;
    }
    return { total, bySet, normal, foil, othersValue, othersCopies };
  }, [cards, bulk, priceOf]);

  useEffect(() => {
    setVisible(ROWS_PER_PAGE);
  }, [search, setId, domainId, rarityId, typeId, altArt, onlyOwned]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableCards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.publicCode.toLowerCase().includes(q)) return false;
      if (setId === OTHERS ? isMainSet(c.set.id) : setId && c.set.id !== setId) return false;
      if (typeId && !c.types.includes(typeId)) return false;
      if (rarityId && c.rarity?.id !== rarityId) return false;
      if (domainId && !c.domains.some((d) => d.id === domainId)) return false;
      if (altArt === "hide" && isAlternateArt(c)) return false;
      if (altArt === "only" && !isAlternateArt(c)) return false;
      const e = bulk[c.id];
      if (onlyOwned && !((e?.normal ?? 0) > 0 || (e?.foil ?? 0) > 0)) return false;
      return true;
    });
  }, [availableCards, search, setId, typeId, rarityId, domainId, altArt, onlyOwned, bulk]);

  const filtersOn = Boolean(search || setId || domainId || rarityId || typeId || altArt !== "all");
  const clearFilters = () => {
    setSearch("");
    setSetId("");
    setDomainId("");
    setRarityId("");
    setTypeId("");
    setAltArt("all");
  };

  if (loading) return <BulkSkeleton />;

  const empty = stats.total.copies === 0;
  const tab = (on: boolean) =>
    `flex h-10 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm transition ${on ? "text-on-accent" : "text-t2 hover:text-t1"}`;
  const filterCount = [domainId, rarityId, typeId].filter(Boolean).length + (altArt !== "all" ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      {/* summary: floats on the page, no box */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-1">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h1 className="font-mono text-[11px] uppercase tracking-[0.22em] text-t3"><span className="mr-2 text-brand-gold">/</span>Bulk · value</h1>
            <p className="num mt-2 font-display text-6xl font-bold leading-none text-t1">{prices ? <CountUp value={stats.total.value} format={formatEur} /> : "…"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex h-1.5 w-48 overflow-hidden rounded-full bg-[rgb(var(--track)/0.18)]" aria-hidden="true">
              <div className="h-full bg-ok" style={{ width: `${(stats.normal / Math.max(1, stats.normal + stats.foil)) * 100}%` }} />
              <div className="h-full flex-1 bg-foil" />
            </div>
            <p className="num flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-t3">
              <span><b className="font-semibold text-t1">{stats.total.copies}</b> cards</span>
              <span><b className="font-semibold text-t1">{stats.total.unique}</b> unique</span>
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ok" />
                <b className="font-semibold text-t1">{stats.normal}</b> normal
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-foil" />
                <b className="font-semibold text-t1">{stats.foil}</b> foil
              </span>
              {stats.total.unpriced > 0 && (
                <span title="Cards without a price">
                  <b className="font-semibold text-t1">{stats.total.unpriced}</b> unpriced
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PriceModeSwitch />
          <BulkScanner />
        </div>
      </header>

      {/* one floating bar: expansions, search, filters */}
      <div className="surface-calm z-20 flex flex-col gap-2.5 rounded-2xl p-2.5 md:sticky md:top-[5.25rem]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SlideGroup role="tablist" aria-label="Expansion" className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            <button type="button" role="tab" data-active={!setId} aria-selected={!setId} className={tab(!setId)} onClick={() => setSetId("")}>
              <span className="font-display font-semibold uppercase tracking-wider">All</span>
              <span className={`num text-xs ${!setId ? "text-on-accent/75" : "text-t3"}`}>{prices ? formatEur(stats.total.value) : "…"}</span>
            </button>
            {availableSets.map((s) => {
              const v = stats.bySet.get(s.id);
              const on = setId === s.id;
              return (
                <button key={s.id} type="button" role="tab" data-active={on} aria-selected={on} title={s.name} className={tab(on)} onClick={() => setSetId(on ? "" : s.id)}>
                  <i aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45" style={{ background: setColor(s.id) }} />
                  <span className="font-display font-semibold tracking-wider">{s.id}</span>
                  <span className={`num text-xs ${on ? "text-on-accent/75" : "text-t3"}`}>{v ? formatEur(v.value) : "–"}</span>
                </button>
              );
            })}
            <button type="button" role="tab" data-active={setId === OTHERS} aria-selected={setId === OTHERS} title="Promos, bundles and other sets" className={tab(setId === OTHERS)} onClick={() => setSetId(setId === OTHERS ? "" : OTHERS)}>
              <span className="font-display font-semibold tracking-wider">Others</span>
              <span className={`num text-xs ${setId === OTHERS ? "text-on-accent/75" : "text-t3"}`}>{stats.othersCopies ? formatEur(stats.othersValue) : "–"}</span>
            </button>
          </SlideGroup>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-64">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-t3">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                aria-label="Search by name or code"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-[rgb(var(--track)/0.05)] pl-10 pr-9 text-sm text-t1 placeholder:text-t3"
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-t3 hover:text-t1">
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
                showFilters ? "border-white/40 text-t1" : "border-white/10 text-t2 hover:border-white/25 hover:text-t1"
              }`}
            >
              Filters
              {filterCount > 0 && (
                <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[11px] font-bold text-on-accent">{filterCount}</span>
              )}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={onlyOwned}
              onClick={() => setOnlyOwned((v) => !v)}
              className="flex h-10 shrink-0 items-center gap-2.5 rounded-md px-2 text-sm font-semibold text-t2 transition hover:text-t1"
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${onlyOwned ? "bg-brand-gold" : "bg-[rgb(var(--track)/0.25)]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full ${onlyOwned ? "left-[18px] bg-on-accent" : "left-0.5 bg-white"} transition-all`} />
              </span>
              Only mine
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5 md:flex md:flex-wrap md:items-center">
            <div className="md:w-40">
              <Select value={domainId} onChange={setDomainId} searchable={false} ariaLabel="Domain" className="h-10 text-sm" menuMinWidth={160} options={[{ value: "", label: "All domains" }, ...DOMAIN_OPTIONS.map((d) => ({ value: d.id, label: d.label }))]} />
            </div>
            <div className="md:w-40">
              <Select value={rarityId} onChange={setRarityId} searchable={false} ariaLabel="Rarity" className="h-10 text-sm" menuMinWidth={160} options={[{ value: "", label: "All rarities" }, ...RARITY_OPTIONS.map((r) => ({ value: r.id, label: r.label }))]} />
            </div>
            <div className="md:w-40">
              <Select value={typeId} onChange={setTypeId} searchable={false} ariaLabel="Type" className="h-10 text-sm" menuMinWidth={160} options={[{ value: "", label: "All types" }, ...TYPE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))]} />
            </div>
            <div className="md:w-40">
              <Select value={altArt} onChange={(v) => setAltArt(v as AltArt)} searchable={false} ariaLabel="Art" className="h-10 text-sm" menuMinWidth={160} options={ART_OPTIONS} />
            </div>
            {filtersOn && (
              <button type="button" onClick={clearFilters} className="col-span-2 h-10 px-2 text-sm font-semibold text-t2 hover:text-t1 md:col-span-1">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      <p className="num -mb-2 px-1 text-xs text-t3">
        <b className="text-t1">{filtered.length}</b> card{filtered.length === 1 ? "" : "s"}
        {filtersOn && (
          <button type="button" onClick={clearFilters} className="ml-3 font-semibold text-t2 hover:text-t1">Clear filters</button>
        )}
      </p>

      {/* list */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-t3">
          {empty && !filtersOn
            ? "Your bulk is empty. Hit Scan cards and point the camera at a pile, or turn off “Only my bulk” to search for cards and add them."
            : "No cards match. Try clearing the filters."}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.slice(0, visible).map((card) => (
              <CardTile key={card.id} card={card} normalQty={bulk[card.id]?.normal ?? 0} foilQty={bulk[card.id]?.foil ?? 0} onInspect={() => setInspect(card)} />
            ))}
          </ul>
          {visible < filtered.length && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + ROWS_PER_PAGE)}
                className="h-11 rounded-lg border border-line bg-panel px-6 font-display text-xs font-semibold uppercase tracking-wide text-t1 transition hover:border-line2 hover:bg-panel2"
              >
                Show more ({filtered.length - visible} left)
              </button>
            </div>
          )}
        </>
      )}

      {inspect && <CardDetailModal card={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
