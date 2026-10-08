"use client";

import Image from "next/image";
import { BottomSheet } from "@/components/BottomSheet";
import type { RiftCard } from "@/lib/types";

export function CardSheet({
  card,
  qty,
  onQty,
  onMove,
  onRemove,
  onClose,
}: {
  card: RiftCard;
  qty: number;
  onQty: (qty: number) => void;
  onMove: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="flex gap-4">
        <div className="relative aspect-[744/1039] w-32 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black">
          {card.image.url && (
            <Image src={card.image.url} alt={card.image.alt} fill sizes="128px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-tight text-white">{card.name}</p>
          {card.subtitle && <p className="text-sm text-white/60">{card.subtitle}</p>}
          <p className="mt-2 text-xs text-white/50">{card.publicCode}</p>
          <p className="text-xs text-white/50">
            {card.set.name}
            {card.rarity ? ` · ${card.rarity.label}` : ""}
          </p>

          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Copies in this slot
          </p>
          <div className="flex items-center gap-1 self-start rounded-full bg-white/5 p-1 ring-1 ring-inset ring-white/10">
            <button
              type="button"
              onClick={() => onQty(qty - 1)}
              disabled={qty <= 1}
              aria-label="One less copy"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white/70 active:bg-white/10 disabled:opacity-25"
            >
              −
            </button>
            <span className="w-8 text-center font-display text-xl font-bold tabular-nums text-brand-gold">{qty}</span>
            <button
              type="button"
              onClick={() => onQty(qty + 1)}
              aria-label="One more copy"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white/70 active:bg-white/10"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onMove}
          className="h-12 rounded-full border-[1.5px] border-brand-gold font-display text-sm font-semibold uppercase tracking-wide text-brand-gold active:bg-brand-gold/10"
        >
          Move
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="h-12 rounded-full border border-brand-red/40 bg-brand-red/10 font-display text-sm font-semibold uppercase tracking-wide text-brand-red active:bg-brand-red/20"
        >
          Remove
        </button>
      </div>
    </BottomSheet>
  );
}
