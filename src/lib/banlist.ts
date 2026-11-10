// Cards banned in Riftbound Standard Constructed. The card data has no "banned" field (the BANNED stamp is part
// of the card's picture), so the list is kept here by hand - edit it when Riot changes the bans.
// Source: the official ban announcements, as listed by https://riftbound.gg/riftbound-banned-card-list/
// (last change on that page: Ekko, Recurrent and Stacked Deck, effective 2026-09-18).
//
// Names are written as "Name, Subtitle" for cards with a subtitle. Matching ignores case, punctuation and apostrophes.

const BANNED_CARDS = [
  "Scrapheap",
  "Called Shot",
  "Fight or Flight",
  "Stacked Deck",
  "Draven, Vanquisher",
  "Ekko, Recurrent",
  "Stealthy Pursuer",
];

const BANNED_BATTLEFIELDS = ["Aspirant's Climb", "Obelisk of Power", "Reaver's Row", "The Arena's Greatest", "The Dreaming Tree"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const BANNED = new Set([...BANNED_CARDS, ...BANNED_BATTLEFIELDS].map(norm));

export function isBanned(card: { name: string; subtitle: string | null }): boolean {
  const full = card.subtitle ? `${card.name}, ${card.subtitle}` : card.name;
  return BANNED.has(norm(full));
}
