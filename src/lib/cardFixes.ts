import type { RiftCard } from "./types";

// Corrections that neither source has right. Demon Shade (RAD-102) is listed as
// Fury by Riot and TCGplayer, but sits in the Chaos block of the set and is legal
// in Chaos decks (verified against a RiftAtlas deck).
const MANUAL: Record<string, string[]> = {
  "rad-102-167": ["chaos"],
};

const LABELS: Record<string, string> = {
  fury: "Fury",
  calm: "Calm",
  mind: "Mind",
  body: "Body",
  chaos: "Chaos",
  order: "Order",
  colorless: "Colorless",
};

// `domainFixes`: domains of unreleased cards from TCGplayer (Maintenance page).
export function applyCardFixes(cards: RiftCard[], domainFixes: Record<string, string[]>): RiftCard[] {
  return cards.map((card) => {
    const ids = MANUAL[card.id] ?? domainFixes[card.id];
    if (!ids) return card;
    return { ...card, domains: ids.map((id) => ({ id, label: LABELS[id] ?? id })) };
  });
}
