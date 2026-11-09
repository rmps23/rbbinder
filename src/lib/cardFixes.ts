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
// They only fill in cards for which Riot lists no domain: TCGplayer's data for
// unreleased cards is placeholder-quality (e.g. it had Bilgewater Tracker as Fury,
// but Riot, and the Evelynn showdown deck it comes in, say Body), so once Riot
// publishes a domain it wins. MANUAL corrections always apply.
export function applyCardFixes(cards: RiftCard[], domainFixes: Record<string, string[]>): RiftCard[] {
  return cards.map((card) => {
    const ids = MANUAL[card.id] ?? (card.domains.length === 0 ? domainFixes[card.id] : undefined);
    if (!ids) return card;
    return { ...card, domains: ids.map((id) => ({ id, label: LABELS[id] ?? id })) };
  });
}
