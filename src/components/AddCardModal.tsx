"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filters, FilterState } from "./Filters";
import { PAGE_SIZE } from "@/lib/constants";
import type { RiftCard, SetInfo } from "@/lib/types";

export function AddCardModal({
  cards,
  sets,
  initialPosition,
  filters,
  onFiltersChange,
  onCommit,
  onClose,
}: {
  cards: RiftCard[];
  sets: SetInfo[];
  initialPosition: number;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  onCommit: (queue: RiftCard[]) => void;
  onClose: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [queue, setQueue] = useState<RiftCard[]>([]);
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const scrolledRef = useRef(false);

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

  const targetIndex = filtered.length ? Math.min(initialPosition, filtered.length - 1) : -1;

  // Reveal enough cards to include the one nearest this binder slot's
  // position, then scroll it into view once.
  useEffect(() => {
    if (scrolledRef.current || targetIndex < 0) return;
    if (targetIndex >= visibleCount) {
      setVisibleCount(Math.min(filtered.length, targetIndex + PAGE_SIZE));
      return;
    }
    if (targetRef.current) {
      targetRef.current.scrollIntoView({ block: "center" });
      scrolledRef.current = true;
    }
  }, [targetIndex, visibleCount, filtered.length]);

  const visible = filtered.slice(0, visibleCount);

  function addToQueue(card: RiftCard) {
    setQueue((q) => [...q, card]);
  }

  function removeFromQueue(index: number) {
    setQueue((q) => q.filter((_, i) => i !== index));
  }

  function moveInQueue(index: number, direction: -1 | 1) {
    setQueue((q) => {
      const target = index + direction;
      if (target < 0 || target >= q.length) return q;
      const next = [...q];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col rounded-lg border border-white/10 bg-[#0d0f14] p-4 shadow-xl sm:flex-row sm:gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Escolher cartas</h2>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white sm:hidden"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <p className="mb-3 text-sm text-white/40">
            Clica em quantas cartas quiseres para as juntares à lista, ajusta-as e depois carrega em &quot;Adicionar&quot;.
          </p>

          <Filters sets={sets} state={filters} onChange={onFiltersChange} />

          <p className="mb-3 text-sm text-white/40">
            {filtered.length} carta{filtered.length === 1 ? "" : "s"}
          </p>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-white/40">Nenhuma carta encontrada com estes filtros.</p>
          ) : (
            <>
              <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {visible.map((card, i) => (
                  <button
                    key={card.id}
                    ref={i === targetIndex ? targetRef : undefined}
                    onClick={() => addToQueue(card)}
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

        <div className="mt-4 flex w-full flex-col border-t border-white/10 pt-4 sm:mt-0 sm:w-64 sm:shrink-0 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="mb-2 hidden items-center justify-between sm:flex">
            <h3 className="text-sm font-semibold text-white">A adicionar</h3>
            <button onClick={onClose} className="rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Fechar">
              ✕
            </button>
          </div>
          <h3 className="mb-2 text-sm font-semibold text-white sm:hidden">A adicionar</h3>

          {queue.length === 0 ? (
            <p className="flex-1 py-6 text-center text-sm text-white/40">
              Ainda não escolheste nenhuma carta. Clica numa à esquerda para a juntares aqui.
            </p>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-y-auto sm:max-h-[50vh]">
              {queue.map((card, i) => (
                <div key={`${card.id}-${i}`} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#14171f] p-1.5">
                  <span className="w-5 shrink-0 text-center text-xs text-white/30">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/90">{card.name}</p>
                    <p className="text-[10px] text-white/40">{card.publicCode}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => moveInQueue(i, -1)}
                      disabled={i === 0}
                      title="Mover para cima"
                      aria-label="Mover para cima"
                      className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveInQueue(i, 1)}
                      disabled={i === queue.length - 1}
                      title="Mover para baixo"
                      aria-label="Mover para baixo"
                      className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeFromQueue(i)}
                      title="Remover da lista"
                      aria-label="Remover da lista"
                      className="flex h-6 w-6 items-center justify-center rounded text-red-300/70 hover:bg-red-500/20 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onCommit(queue)}
            disabled={queue.length === 0}
            className="mt-3 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Adicionar {queue.length > 0 ? `(${queue.length})` : ""} ao binder
          </button>
        </div>
      </div>
    </div>
  );
}
