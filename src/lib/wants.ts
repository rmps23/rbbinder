import { displayName } from "./deck";
import { isChampionUnit, isSignature } from "./deckRules";
import type { RiftCard } from "./types";

// Names of all champion units - used to tell a legend's champion tag ("Kennen")
// apart from its other tags ("Yordle").
export function championNames(cards: RiftCard[]): Set<string> {
  return new Set(cards.filter(isChampionUnit).map((c) => c.name));
}

export function legendChampion(legend: RiftCard, champions: Set<string>): string | null {
  return legend.tags.find((t) => champions.has(t)) ?? legend.tags[legend.tags.length - 1] ?? null;
}

// Where Cardmarket's own spelling differs from Riot's.
const CARDMARKET_SPELLING: Record<string, string> = {
  "ziggs, short-fused": "Ziggs, Short Fused",
  "lillia, fae fawn": "Lillia Fae Fawn",
};

// The name as Cardmarket lists it.
//  - Legends: "<Champion>, <Legend title>" (Riot names them by the title alone,
//    or "<title>, Starter" for the Proving Grounds ones).
//  - Signature cards: just the card name (Riot adds the champion as subtitle).
//  - Tokens: without Riot's "(DE)"-style suffix.
export function cardmarketName(card: RiftCard, champions: Set<string>): string {
  let name: string;
  if (card.types.includes("legend")) {
    const champ = legendChampion(card, champions);
    name = champ ? `${champ}, ${card.name}` : displayName(card);
  } else if (isSignature(card)) {
    name = card.name;
  } else {
    name = displayName(card).replace(/\s*\([A-Z]{2,3}\)$/, "");
  }
  return CARDMARKET_SPELLING[name.toLowerCase()] ?? name;
}

// Cardmarket's "Add Deck List" format, one card per line: "2x Teemo, Scout (Origins)".
export function cardmarketWants(items: { card: RiftCard; qty: number }[], cards: RiftCard[]): string {
  const champs = championNames(cards);
  const lines = items
    .filter((i) => i.qty > 0)
    .map((i) => ({ set: i.card.set.name, name: cardmarketName(i.card, champs), qty: i.qty }))
    .sort((a, b) => a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
  return lines.map((l) => `${l.qty}x ${l.name} (${l.set})`).join("\n") + (lines.length ? "\n" : "");
}
