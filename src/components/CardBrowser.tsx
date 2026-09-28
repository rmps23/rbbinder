"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { Filters, FilterState } from "./Filters";
import { CardTile } from "./CardTile";
import { PAGE_SIZE } from "@/lib/constants";
import { isAlternateArt } from "@/lib/cardUtils";
import type { RiftCard } from "@/lib/types";

// Proving Grounds isn't tracked for bulk/trades.
const EXCLUDED_SETS = new Set(["OGS"]);

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  altArt: "all",
  onlyOwned: false,
};

export function CardBrowser({
  onlyOwnedLabel,
  defaultOnlyOwned = false,
  emptyMessage,
}: {
  onlyOwnedLabel: string;
  defaultOnlyOwned?: boolean;
  emptyMessage: string;
}) {
  const { cards, sets, bulk, loading, setBulkQty } = useAppData();
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    onlyOwned: defaultOnlyOwned,
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const availableCards = useMemo(() => cards.filter((c) => !EXCLUDED_SETS.has(c.set.id)), [cards]);
  const availableSets = useMemo(() => sets.filter((s) => !EXCLUDED_SETS.has(s.id)), [sets]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return availableCards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search) && !c.publicCode.toLowerCase().includes(search)) {
        return false;
      }
      if (filters.setId && c.set.id !== filters.setId) return false;
      if (filters.typeId && !c.types.includes(filters.typeId)) return false;
      if (filters.rarityId && c.rarity?.id !== filters.rarityId) return false;
      if (filters.domainId && !c.domains.some((d) => d.id === filters.domainId)) return false;
      if (filters.altArt === "hide" && isAlternateArt(c)) return false;
      if (filters.altArt === "only" && !isAlternateArt(c)) return false;
      const entry = bulk[c.id];
      if (filters.onlyOwned && !((entry?.normal ?? 0) > 0 || (entry?.foil ?? 0) > 0)) return false;
      return true;
    });
  }, [availableCards, filters, bulk]);

  const visible = filtered.slice(0, visibleCount);

  // Cards are already sorted by set, so grouping the visible slice just
  // means starting a new group whenever the set changes.
  const groups = useMemo(() => {
    const result: { setId: string; setName: string; cards: RiftCard[] }[] = [];
    for (const card of visible) {
      const last = result[result.length - 1];
      if (last && last.setId === card.set.id) last.cards.push(card);
      else result.push({ setId: card.set.id, setName: card.set.name, cards: [card] });
    }
    return result;
  }, [visible]);

  if (loading) {
    return <p className="py-10 text-center text-white/40">Loading cards...</p>;
  }

  return (
    <div>
      <Filters sets={availableSets} state={filters} onChange={setFilters} onlyOwnedLabel={onlyOwnedLabel} />

      <p className="mb-3 text-sm text-white/40">
        {filtered.length} card{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-white/40">{emptyMessage}</p>
      ) : (
        <>
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.setId}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                  {group.setName}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {group.cards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      normalQty={bulk[card.id]?.normal ?? 0}
                      foilQty={bulk[card.id]?.foil ?? 0}
                      onChangeNormal={(qty) => setBulkQty(card.id, "normal", qty)}
                      onChangeFoil={(qty) => setBulkQty(card.id, "foil", qty)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Show more ({filtered.length - visibleCount} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
