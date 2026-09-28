"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { Filters, FilterState } from "./Filters";
import { CardTile } from "./CardTile";
import { PAGE_SIZE } from "@/lib/constants";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return cards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search) && !c.publicCode.toLowerCase().includes(search)) {
        return false;
      }
      if (filters.setId && c.set.id !== filters.setId) return false;
      if (filters.typeId && !c.types.includes(filters.typeId)) return false;
      if (filters.rarityId && c.rarity?.id !== filters.rarityId) return false;
      if (filters.domainId && !c.domains.some((d) => d.id === filters.domainId)) return false;
      if (filters.onlyOwned && (bulk[c.id] ?? 0) <= 0) return false;
      return true;
    });
  }, [cards, filters, bulk]);

  const visible = filtered.slice(0, visibleCount);

  if (loading) {
    return <p className="py-10 text-center text-white/40">A carregar cartas...</p>;
  }

  return (
    <div>
      <Filters sets={sets} state={filters} onChange={setFilters} onlyOwnedLabel={onlyOwnedLabel} />

      <p className="mb-3 text-sm text-white/40">
        {filtered.length} carta{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-white/40">{emptyMessage}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visible.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                qty={bulk[card.id] ?? 0}
                onChangeQty={(qty) => setBulkQty(card.id, qty)}
                accent="sky"
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Mostrar mais ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
