import domainFixes from "./cardDomainFixes.json";
import type { RiftCard } from "./types";

// Domains of unreleased cards, from TCGplayer (see scripts/build-domain-fixes.mjs).
const DOMAINS = domainFixes as Record<string, string[]>;

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

export function applyCardFixes(cards: RiftCard[]): RiftCard[] {
  return cards.map((card) => {
    const ids = MANUAL[card.id] ?? DOMAINS[card.id];
    if (!ids) return card;
    return { ...card, domains: ids.map((id) => ({ id, label: LABELS[id] ?? id })) };
  });
}
