"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";
import { rarityColor } from "@/lib/style";
import { QuantityStepper } from "./QuantityStepper";

export function CardTile({
  card,
  qty,
  onChangeQty,
  accent,
}: {
  card: RiftCard;
  qty: number;
  onChangeQty: (qty: number) => void;
  accent: "amber" | "sky";
}) {
  const [imgError, setImgError] = useState(false);
  const owned = qty > 0;

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-lg border bg-[#14171f] transition ${
        owned ? "border-amber-400/40" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[744/1039] w-full bg-[#0a0c10]">
        {card.image.url && !imgError ? (
          <Image
            src={card.image.url}
            alt={card.image.alt}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
            className={`object-cover transition ${owned ? "" : "opacity-45 grayscale-[35%]"}`}
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
        {owned && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
            x{qty}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">{card.name}</p>
        <p className="text-[10px] text-white/40">{card.publicCode}</p>
        <div className="mt-auto pt-1">
          <QuantityStepper value={qty} onChange={onChangeQty} accent={accent} />
        </div>
      </div>
    </div>
  );
}
