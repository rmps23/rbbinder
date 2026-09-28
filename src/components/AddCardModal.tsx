"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filters, FilterState } from "./Filters";
import { PAGE_SIZE } from "@/lib/constants";
import type { RiftCard, SetInfo } from "@/lib/types";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  onlyOwned: false,
};

export function AddCardModal({
  cards,
  sets,
  onPick,
  onClose,
}: {
  cards: RiftCard[];
  sets: SetInfo[];
  onPick: (card: RiftCard) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [addedCount, setAddedCount] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const lastAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePick(card: RiftCard) {
    onPick(card);
    setAddedCount((n) => n + 1);
    setLastAdded(card.name);
    if (lastAddedTimer.current) clearTimeout(lastAddedTimer.current);
    lastAddedTimer.current = setTimeout(() => setLastAdded(null), 1200);
  }

  useEffect(() => {
    return () => {
      if (lastAddedTimer.current) clearTimeout(lastAddedTimer.current);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
      return true;
    });
  }, [cards, filters]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-lg border border-white/10 bg-[#0d0f14] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Escolher cartas</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-white/40">
          Clica em quantas cartas quiseres — vão-se colocando nos espaços seguintes. Fecha quando terminares.
        </p>

        <Filters sets={sets} state={filters} onChange={setFilters} />

        <div className="mb-3 flex items-center justify-between text-sm text-white/40">
          <span>
            {filtered.length} carta{filtered.length === 1 ? "" : "s"}
          </span>
          {addedCount > 0 && (
            <span className="font-medium text-amber-300">
              {lastAdded ? `+ ${lastAdded} adicionada` : `${addedCount} carta${addedCount === 1 ? "" : "s"} adicionada${addedCount === 1 ? "" : "s"}`}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-white/40">Nenhuma carta encontrada com estes filtros.</p>
        ) : (
          <>
            <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
              {visible.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handlePick(card)}
                  className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#14171f] text-left transition hover:border-amber-400/60"
                >
                  <div className="relative aspect-[744/1039] w-full bg-[#0a0c10]">
                    {card.image.url ? (
                      <Image
                        src={card.image.url}
                        alt={card.image.alt}
                        fill
                        sizes="(max-width: 640px) 30vw, 16vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-white/40">
                        {card.name}
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white/90">{card.name}</p>
                    <p className="text-[10px] text-white/40">{card.publicCode}</p>
                  </div>
                </button>
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="mt-4 flex justify-center">
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
    </div>
  );
}
