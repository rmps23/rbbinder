"use client";

import { SlideGroup } from "@/components/SlideGroup";
import { BulkSkeleton } from "@/components/Skeletons";
import Image from "next/image";
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
import { rarityColor } from "@/lib/style";
import { valueBulk } from "@/lib/valuation";
import type { RiftCard } from "@/lib/types";

// Proving Grounds isn't tracked for bulk/trades.
const EXCLUDED_SETS = new Set(["OGS"]);
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

  return (
    <li className={`flex flex-col overflow-hidden rounded-xl border bg-panel transition ${owned ? "border-line2" : "border-line"}`}>
      <button
        type="button"
        onClick={onInspect}
        aria-label={`${card.name}, open details`}
        className="relative block aspect-[744/1039] w-full bg-ink"
      >
        {card.image.url && (
          <Image
            src={card.image.url}
            alt=""
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1280px) 22vw, 15vw"
            quality={90}
            className={`object-cover transition duration-200 ${owned ? "" : "opacity-50 hover:opacity-90"}`}
          />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-t1" title={card.name}>
            {card.name}
          </p>
          <p className="num mt-0.5 flex items-center gap-1.5 text-xs text-t3">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: rarityColor(card.rarity?.id) }} aria-hidden="true" />
            {card.publicCode}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-2">
          {showNormal && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] leading-tight text-t3">
                {showFoil ? "Normal" : "Normal only"}
                <span className="num block text-xs text-t2">{normalPrice !== null ? formatEur(normalPrice) : "–"}</span>
              </span>
              <QuantityStepper compact value={normalQty} onChange={(q) => setBulkQty(card.id, "normal", q)} accent="cyan" />
            </div>
          )}
          {showFoil && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] leading-tight text-t3">
                {showNormal ? "✦ Foil" : "✦ Foil only"}
                <span className="num block text-xs text-t2">{foilPrice !== null ? formatEur(foilPrice) : "–"}</span>
              </span>
              <QuantityStepper compact value={foilQty} onChange={(q) => setBulkQty(card.id, "foil", q)} accent="gold" />
            </div>
          )}
        </div>
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
  const [visible, setVisible] = useState(ROWS_PER_PAGE);
  const [inspect, setInspect] = useState<RiftCard | null>(null);

  const availableCards = useMemo(() => cards.filter((c) => !EXCLUDED_SETS.has(c.set.id)), [cards]);
  const availableSets = useMemo(() => sets.filter((s) => !EXCLUDED_SETS.has(s.id)), [sets]);

  const stats = useMemo(() => {
    const { total, bySet } = valueBulk(cards, bulk, priceOf);
    let normal = 0;
    let foil = 0;
    for (const e of Object.values(bulk)) {
      normal += e.normal ?? 0;
      foil += e.foil ?? 0;
    }
    return { total, bySet, normal, foil };
  }, [cards, bulk, priceOf]);

  useEffect(() => {
    setVisible(ROWS_PER_PAGE);
  }, [search, setId, domainId, rarityId, typeId, altArt, onlyOwned]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableCards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.publicCode.toLowerCase().includes(q)) return false;
      if (setId && c.set.id !== setId) return false;
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
    `flex min-h-12 min-w-[84px] shrink-0 flex-col items-center justify-center rounded-lg px-3.5 py-1 transition ${
      on ? "text-on-accent" : "text-t2 hover:text-t1"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-line bg-panel">
        {/* summary */}
        <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Bulk</h1>
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <dt className="label">Value</dt>
                <dd className="num mt-1 text-3xl font-bold leading-none text-t1">{prices ? formatEur(stats.total.value) : "…"}</dd>
              </div>
              <div className="hidden h-9 w-px bg-line sm:block" aria-hidden="true" />
              <div>
                <dt className="label">Cards</dt>
                <dd className="num mt-1 text-xl font-bold leading-none text-t1">{stats.total.copies}</dd>
              </div>
              <div>
                <dt className="label">Unique</dt>
                <dd className="num mt-1 text-xl font-bold leading-none text-t1">{stats.total.unique}</dd>
              </div>
              <div>
                <dt className="label">Normal</dt>
                <dd className="num mt-1 text-xl font-bold leading-none text-ok">{stats.normal}</dd>
              </div>
              <div>
                <dt className="label">✦ Foil</dt>
                <dd className="num mt-1 text-xl font-bold leading-none text-foil">{stats.foil}</dd>
              </div>
              {stats.total.unpriced > 0 && (
                <div title="Cards without a price">
                  <dt className="label">Unpriced</dt>
                  <dd className="num mt-1 text-xl font-bold leading-none text-t3">{stats.total.unpriced}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PriceModeSwitch />
            <BulkScanner />
          </div>
        </header>

        {/* expansions + result count */}
        <div className="flex items-center gap-4 border-t border-line px-3 py-2 sm:px-4">
          <SlideGroup role="tablist" aria-label="Expansion" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            <button type="button" role="tab" data-active={!setId} aria-selected={!setId} className={tab(!setId)} onClick={() => setSetId("")}>
              <span className="font-display text-sm font-semibold uppercase tracking-wider">All sets</span>
              <span className={`num text-[11px] font-medium ${!setId ? "text-on-accent/75" : "text-t3"}`}>{prices ? formatEur(stats.total.value) : "…"}</span>
            </button>
            {availableSets.map((s) => {
              const v = stats.bySet.get(s.id);
              const on = setId === s.id;
              return (
                <button key={s.id} type="button" role="tab" data-active={on} aria-selected={on} title={s.name} className={tab(on)} onClick={() => setSetId(on ? "" : s.id)}>
                  <span className="font-display text-sm font-semibold tracking-wider">{s.id}</span>
                  <span className={`num text-[11px] font-medium ${on ? "text-on-accent/75" : "text-t3"}`}>{v ? formatEur(v.value) : "–"}</span>
                </button>
              );
            })}
          </SlideGroup>
          <p className="num hidden shrink-0 items-center gap-3 text-sm text-t3 md:flex">
            {filtered.length} card{filtered.length === 1 ? "" : "s"}
            {filtersOn && (
              <button type="button" onClick={clearFilters} className="font-semibold text-brand-gold hover:underline">
                Clear
              </button>
            )}
          </p>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-3 sm:px-4">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-t3">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              aria-label="Search by name or code"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-ink pl-10 pr-10 text-sm text-t1 placeholder:text-t3"
            />
            {search && (
              <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-t3 hover:bg-cavity hover:text-t1">
                ✕
              </button>
            )}
          </div>
          <div className="w-36">
            <Select value={domainId} onChange={setDomainId} searchable={false} ariaLabel="Domain" className="h-11 text-sm" menuMinWidth={160} options={[{ value: "", label: "All domains" }, ...DOMAIN_OPTIONS.map((d) => ({ value: d.id, label: d.label }))]} />
          </div>
          <div className="w-36">
            <Select value={rarityId} onChange={setRarityId} searchable={false} ariaLabel="Rarity" className="h-11 text-sm" menuMinWidth={160} options={[{ value: "", label: "All rarities" }, ...RARITY_OPTIONS.map((r) => ({ value: r.id, label: r.label }))]} />
          </div>
          <div className="w-36">
            <Select value={typeId} onChange={setTypeId} searchable={false} ariaLabel="Type" className="h-11 text-sm" menuMinWidth={160} options={[{ value: "", label: "All types" }, ...TYPE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))]} />
          </div>
          <div className="w-36">
            <Select value={altArt} onChange={(v) => setAltArt(v as AltArt)} searchable={false} ariaLabel="Art" className="h-11 text-sm" menuMinWidth={160} options={ART_OPTIONS} />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onlyOwned}
            onClick={() => setOnlyOwned((v) => !v)}
            className="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-ink px-4 text-sm font-semibold text-t2 transition hover:border-line2"
          >
            <span className={`relative h-5 w-9 rounded-full transition-colors ${onlyOwned ? "bg-brand-gold" : "bg-cavity"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${onlyOwned ? "left-[18px]" : "left-0.5"}`} />
            </span>
            Only my bulk
          </button>
        </div>
      </section>

      {/* list */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-t3">
          {empty && !filtersOn
            ? "Your bulk is empty. Hit Scan cards and point the camera at a pile, or turn off “Only my bulk” to search for cards and add them."
            : "No cards match. Try clearing the filters."}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
