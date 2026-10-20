import finishes from "./cardFinishes.json";
import type { RiftCard } from "./types";

export type Finish = "normal" | "foil";
export type Finishes = { normal: boolean; foil: boolean };

type FinishCard = Pick<RiftCard, "id" | "publicCode" | "rarity">;

// Exceptions to the rules below, taken from the English market's product list
// (TCGplayer) by scripts/build-card-finishes.mjs.
const FOIL_ONLY = new Set<string>(finishes.foilOnly);
const NORMAL_ONLY = new Set<string>(finishes.normalOnly);
const BOTH = new Set<string>(finishes.both);

// Which finishes a card exists in. Default rules:
//  - Rare and Epic cards are always foil (Riot: "Every Rare and Epic will
//    always be foil").
//  - Showcase cards (alternate art, overnumbered, signature "*") are foil.
//  - Commons and uncommons exist in both.
// They also cover cards added to the catalog after the exceptions were built
// (and sets that aren't released yet).
export function availableFinishes(card: FinishCard): Finishes {
  if (NORMAL_ONLY.has(card.id)) return { normal: true, foil: false };
  if (FOIL_ONLY.has(card.id)) return { normal: false, foil: true };
  if (BOTH.has(card.id)) return { normal: true, foil: true };
  const rarity = card.rarity?.id;
  if (card.publicCode.includes("*") || rarity === "rare" || rarity === "epic" || rarity === "showcase") {
    return { normal: false, foil: true };
  }
  return { normal: true, foil: true };
}

// The finish to use when `preferred` isn't possible for this card.
export function resolveFinish(card: FinishCard, preferred: Finish): Finish {
  const available = availableFinishes(card);
  if (!available.normal) return "foil";
  if (!available.foil) return "normal";
  return preferred;
}

// When a card could be either (e.g. a binder slot doesn't record its finish),
// assume the plain one.
export function typicalFinish(card: FinishCard): Finish {
  return availableFinishes(card).normal ? "normal" : "foil";
}
