"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";
import { rarityColor } from "@/lib/style";
import { QuantityStepper } from "./QuantityStepper";

export function BinderSlotTile({
  card,
  qty,
  onChangeQty,
  onPick,
}: {
  card: RiftCard | null;
  qty: number;
  onChangeQty: (qty: number) => void;
  onPick: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  if (!card) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex aspect-[744/1039] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/10 bg-[#0d0f14]/40 text-white/15 transition hover:border-amber-400/50 hover:text-amber-400/70"
      >
        <span className="text-3xl leading-none">+</span>
        <span className="text-[10px] font-medium">Adicionar carta</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-amber-400/40 bg-[#14171f]">
      <div className="relative aspect-[744/1039] w-full bg-[#0a0c10]">
        {card.image.url && !imgError ? (
          <Image
            src={card.image.url}
            alt={card.image.alt}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-white/40">
            {card.name}
          </div>
        )}
        <span
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
          style={{ backgroundColor: rarityColor(card.rarity?.id) }}
          title={card.rarity?.label ?? ""}
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
          x{qty}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">{card.name}</p>
        <p className="text-[10px] text-white/40">{card.publicCode}</p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <QuantityStepper value={qty} onChange={onChangeQty} accent="amber" />
          <button
            type="button"
            onClick={onPick}
            title="Trocar carta deste espaço"
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
          >
            Trocar
          </button>
        </div>
      </div>
    </div>
  );
}
