"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";
import { rarityColor } from "@/lib/style";
import { QuantityStepper } from "./QuantityStepper";

export function CardTile({
  card,
  normalQty,
  foilQty,
  onChangeNormal,
  onChangeFoil,
}: {
  card: RiftCard;
  normalQty: number;
  foilQty: number;
  onChangeNormal: (qty: number) => void;
  onChangeFoil: (qty: number) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const owned = normalQty > 0 || foilQty > 0;
  const ring = rarityColor(card.rarity?.id);

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border-2 bg-panel transition"
      style={{ borderColor: owned ? ring : "rgba(255,255,255,0.08)" }}
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
        {owned && (
          <div className="absolute inset-x-0 bottom-0 flex bg-ink/85 backdrop-blur-[2px]">
            <div
              className={`flex w-1/2 items-center justify-center gap-1 py-1 font-display text-sm font-bold ${
                normalQty > 0 ? "text-brand-cyan" : "text-white/25"
              }`}
            >
              {normalQty}
            </div>
            <div className="w-px shrink-0 bg-white/10" />
            <div
              className={`flex w-1/2 items-center justify-center gap-1 py-1 font-display text-sm font-bold ${
                foilQty > 0 ? "text-brand-gold" : "text-white/25"
              }`}
            >
              ✦{foilQty}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">{card.name}</p>
        <p className="text-[10px] text-white/40">{card.publicCode}</p>
        <div className="mt-auto flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-white/40">Normal</span>
            <QuantityStepper value={normalQty} onChange={onChangeNormal} accent="cyan" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-white/40">Foil</span>
            <QuantityStepper value={foilQty} onChange={onChangeFoil} accent="gold" />
          </div>
        </div>
      </div>
    </div>
  );
}
