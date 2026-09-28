"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";
import { rarityColor } from "@/lib/style";

type DropZone = "before" | "after" | "swap";

export function BinderSlotTile({
  position,
  card,
  qty,
  onPick,
  onRemove,
  onDropCard,
  onInsertAt,
}: {
  position: number;
  card: RiftCard | null;
  qty: number;
  onPick: () => void;
  onRemove: () => void;
  onDropCard: (fromPosition: number, toPosition: number) => void;
  onInsertAt: (fromPosition: number, insertPosition: number) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  if (!card) {
    return (
      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setDropZone("swap");
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDropZone(null);
          const from = Number(e.dataTransfer.getData("text/plain"));
          if (!Number.isNaN(from) && from !== position) onDropCard(from, position);
        }}
        className={`flex aspect-[744/1039] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition ${
          dropZone
            ? "border-amber-400 bg-amber-400/10 text-amber-300"
            : "border-white/10 bg-[#0d0f14]/40 text-white/15 hover:border-amber-400/50 hover:text-amber-400/70"
        }`}
      >
        <span className="text-3xl leading-none">+</span>
        <span className="text-[10px] font-medium">Adicionar carta</span>
      </button>
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.25) setDropZone("before");
    else if (relX > 0.75) setDropZone("after");
    else setDropZone("swap");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const zone = dropZone;
    setDropZone(null);
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from) || from === position) return;
    if (zone === "before") onInsertAt(from, position);
    else if (zone === "after") onInsertAt(from, position + 1);
    else onDropCard(from, position);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(position));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={handleDrop}
      className={`group relative aspect-[744/1039] w-full cursor-grab overflow-hidden rounded-lg border bg-[#0a0c10] transition active:cursor-grabbing ${
        dropZone === "swap" ? "border-amber-400 ring-2 ring-amber-400/50" : "border-white/10"
      }`}
    >
      {card.image.url && !imgError ? (
        <Image
          src={card.image.url}
          alt={card.image.alt}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
          className="pointer-events-none object-cover"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-white/40">
          {card.name}
        </div>
      )}

      {dropZone === "before" && (
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" />
      )}
      {dropZone === "after" && (
        <span className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" />
      )}

      <span
        className="absolute right-1.5 bottom-1.5 h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
        style={{ backgroundColor: rarityColor(card.rarity?.id) }}
        title={card.rarity?.label ?? ""}
      />

      <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-base font-bold text-amber-300 ring-1 ring-white/10">
        {qty}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remover carta deste espaço"
        aria-label="Remover carta deste espaço"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 shadow transition hover:bg-red-500 group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7" />
        </svg>
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-b from-transparent to-black/90 p-2 pt-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">{card.name}</p>
        <p className="text-[10px] text-white/60">{card.publicCode}</p>
      </div>
    </div>
  );
}
