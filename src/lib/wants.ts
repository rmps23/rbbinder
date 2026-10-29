import { displayName } from "./deck";
import type { RiftCard } from "./types";

// Name as Cardmarket lists it. Legends are named by their title alone in Riot's
// data ("Agony's Embrace"); Cardmarket uses "Evelynn, Agony's Embrace".
export function cardmarketName(card: RiftCard): string {
  if (!card.subtitle && card.types.includes("legend") && card.tags[0]) return `${card.tags[0]}, ${card.name}`;
  return displayName(card);
}

// Cardmarket's "Add Deck List" format, one card per line: "2x Teemo, Scout (Origins)".
export function cardmarketWants(items: { card: RiftCard; qty: number }[]): string {
  return (
    items
      .filter((i) => i.qty > 0)
      .sort((a, b) => a.card.set.name.localeCompare(b.card.set.name) || cardmarketName(a.card).localeCompare(cardmarketName(b.card)))
      .map((i) => `${i.qty}x ${cardmarketName(i.card)} (${i.card.set.name})`)
      .join("\n") + "\n"
  );
}
