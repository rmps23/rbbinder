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

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-lg border bg-[#14171f] transition ${
        owned ? "border-sky-400/40" : "border-white/10"
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
          <div className="absolute inset-x-0 bottom-0 flex bg-black/70 backdrop-blur-[2px]">
            <div
              className={`flex w-1/2 items-center justify-center gap-1 py-1 text-sm font-bold ${
                normalQty > 0 ? "text-sky-300" : "text-white/25"
              }`}
            >
              {normalQty}
            </div>
            <div className="w-px shrink-0 bg-white/10" />
            <div
              className={`flex w-1/2 items-center justify-center gap-1 py-1 text-sm font-bold ${
                foilQty > 0 ? "text-fuchsia-300" : "text-white/25"
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
            <QuantityStepper value={normalQty} onChange={onChangeNormal} accent="sky" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-white/40">Foil</span>
            <QuantityStepper value={foilQty} onChange={onChangeFoil} accent="fuchsia" />
          </div>
        </div>
      </div>
    </div>
  );
}
