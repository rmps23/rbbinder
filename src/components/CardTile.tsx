"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";
import { rarityColor } from "@/lib/style";
import { availableFinishes } from "@/lib/cardFinish";
import { formatEur } from "@/lib/format";
import { useAppData } from "./AppDataProvider";
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
  const { priceOf } = useAppData();
  const owned = normalQty > 0 || foilQty > 0;
  const ring = rarityColor(card.rarity?.id);
  // Only offer the finishes this card actually exists in - but never hide one
  // you already have copies of.
  const finishes = availableFinishes(card);
  const showNormal = finishes.normal || normalQty > 0;
  const showFoil = finishes.foil || foilQty > 0;
  const single = showNormal !== showFoil;
  const normalPrice = showNormal ? priceOf(card, "normal") : null;
  const foilPrice = showFoil ? priceOf(card, "foil") : null;

  return (
    <div
      className="group flex animate-card-in flex-col overflow-hidden rounded-xl border-2 bg-panel transition duration-200 hover:-translate-y-1"
      style={{
        borderColor: owned ? ring : "rgba(255,255,255,0.08)",
        boxShadow: owned ? `0 10px 26px -14px ${ring}` : undefined,
      }}
    >
      <div className="relative aspect-[744/1039] w-full bg-[#0a0c10]">
        {card.image.url && !imgError ? (
          <Image
            src={card.image.url}
            alt={card.image.alt}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
            className={`object-cover transition duration-300 group-hover:scale-[1.04] ${owned ? "" : "opacity-45 grayscale-[35%] group-hover:opacity-80 group-hover:grayscale-0"}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-white/40">
            {card.name}
          </div>
        )}
        {owned && (
          <div className="absolute inset-x-0 bottom-0 flex bg-ink/85 backdrop-blur-[2px]">
            {showNormal && (
              <div
                className={`flex flex-1 items-center justify-center gap-1 py-1 font-display text-sm font-bold ${
                  normalQty > 0 ? "text-brand-cyan" : "text-white/25"
                }`}
              >
                {normalQty}
              </div>
            )}
            {showNormal && showFoil && <div className="w-px shrink-0 bg-white/10" />}
            {showFoil && (
              <div
                className={`flex flex-1 items-center justify-center gap-1 py-1 font-display text-sm font-bold ${
                  foilQty > 0 ? "text-brand-gold" : "text-white/25"
                }`}
              >
                ✦{foilQty}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">{card.name}</p>
        <p className="text-[10px] text-white/40">{card.publicCode}</p>
        <div className="mt-auto flex flex-col gap-1 pt-1">
          {showNormal && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium leading-tight text-white/40">
                {single ? "Normal only" : "Normal"}
                {normalPrice !== null && <span className="block text-white/65">{formatEur(normalPrice)}</span>}
              </span>
              <QuantityStepper value={normalQty} onChange={onChangeNormal} accent="cyan" />
            </div>
          )}
          {showFoil && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium leading-tight text-white/40">
                {single ? "Foil only" : "Foil"}
                {foilPrice !== null && <span className="block text-white/65">{formatEur(foilPrice)}</span>}
              </span>
              <QuantityStepper value={foilQty} onChange={onChangeFoil} accent="gold" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
