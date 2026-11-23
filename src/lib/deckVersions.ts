// Versions of one deck: each is its own saved deck, sharing a family and numbered.

import type { Deck } from "./types";

export type DeckFamily = { id: string; name: string; latest: Deck; versions: Deck[] }; // newest version first

// In the order of `decks` (by each family's first one).
export function deckFamilies(decks: Deck[]): DeckFamily[] {
  const map = new Map<string, Deck[]>();
  for (const d of decks) map.set(d.familyId, [...(map.get(d.familyId) ?? []), d]);
  return [...map.entries()].map(([id, list]) => {
    const versions = [...list].sort((a, b) => b.version - a.version);
    return { id, name: versions[0].name, latest: versions[0], versions };
  });
}

export const hasVersions = (f: DeckFamily) => f.versions.length > 1;

// "Shenneth v2", or just "Shenneth" for a deck with a single version.
export function deckLabels(decks: Deck[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of deckFamilies(decks)) {
    for (const d of f.versions) out.set(d.id, hasVersions(f) || d.version > 1 ? `${f.name} v${d.version}` : f.name);
  }
  return out;
}

// Options for a deck picker, a family's versions together with the newest first.
export function deckOptions(decks: Deck[]): { value: string; label: string }[] {
  const labels = deckLabels(decks);
  return deckFamilies(decks).flatMap((f) => f.versions.map((d) => ({ value: d.id, label: labels.get(d.id) ?? d.name })));
}
