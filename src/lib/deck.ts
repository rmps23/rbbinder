import { isAlternateArt } from "./cardUtils";
import type { Deck, DeckEntry, DeckZone, RiftCard } from "./types";

export const ZONES: { id: DeckZone; label: string; heading: string; target: number | null; max: number | null }[] = [
  { id: "legend", label: "Legend", heading: "Legend", target: 1, max: 1 },
  { id: "champion", label: "Champion", heading: "Champion", target: 1, max: 1 },
  { id: "main", label: "Main deck", heading: "MainDeck", target: 40, max: null },
  { id: "battlefield", label: "Battlefields", heading: "Battlefields", target: 3, max: null },
  { id: "rune", label: "Runes", heading: "Runes", target: 12, max: null },
  { id: "sideboard", label: "Sideboard", heading: "Sideboard", target: null, max: 10 },
];

// Same card, any printing (alt art, promo, other set) -> same key.
export function cardKey(card: Pick<RiftCard, "name" | "subtitle">): string {
  return norm(card.subtitle ? `${card.name}, ${card.subtitle}` : card.name);
}

// Lowercase, curly quotes -> straight, single spaces: deck lists differ in these.
function norm(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function displayName(card: Pick<RiftCard, "name" | "subtitle">): string {
  return card.subtitle ? `${card.name}, ${card.subtitle}` : card.name;
}

export function defaultZone(card: RiftCard): DeckZone {
  if (card.types.includes("legend")) return "legend";
  if (card.types.includes("battlefield")) return "battlefield";
  if (card.types.includes("rune")) return "rune";
  return "main";
}

export type DeckIndex = {
  byKey: Map<string, RiftCard[]>;
  // lowercase text a deck list may use for a card -> its key
  lookup: Map<string, string>;
};

function printingRank(c: RiftCard): number {
  // Prefer the plain, regular printing as the one shown/used for imports.
  return (c.publicCode.includes("*") ? 4 : 0) + (isAlternateArt(c) ? 2 : 0) + (c.set.id === "OGS" ? 1 : 0);
}

export function buildDeckIndex(cards: RiftCard[]): DeckIndex {
  const byKey = new Map<string, RiftCard[]>();
  for (const c of cards) {
    const k = cardKey(c);
    const list = byKey.get(k);
    if (list) list.push(c);
    else byKey.set(k, [c]);
  }
  for (const list of byKey.values()) list.sort((a, b) => printingRank(a) - printingRank(b));
  const lookup = new Map<string, string>();
  const nameOnly = new Map<string, string | null>();
  for (const [k, list] of byKey) {
    const c = list[0];
    lookup.set(k, k);
    if (c.subtitle) {
      lookup.set(norm(`${c.name} - ${c.subtitle}`), k);
      lookup.set(norm(`${c.name} ${c.subtitle}`), k);
    }
    const n = norm(c.name);
    nameOnly.set(n, nameOnly.has(n) ? null : k); // null = ambiguous
  }
  for (const [n, k] of nameOnly) if (k && !lookup.has(n)) lookup.set(n, k);
  return { byKey, lookup };
}

export function representative(index: DeckIndex, key: string): RiftCard | undefined {
  return index.byKey.get(key)?.[0];
}

// ---------- text format ----------
//
//   Legend:
//   1 Jinx, Loose Cannon
//
//   MainDeck:
//   3 Fizz, Trickster
//
// "3x Card" and "Card x3" are accepted on import as well.

export function exportDeck(deck: Pick<Deck, "entries">, cardById: Map<string, RiftCard>): string {
  const blocks: string[] = [];
  for (const zone of ZONES) {
    const counts = new Map<string, number>();
    for (const e of deck.entries) {
      const card = cardById.get(e.cardId);
      if (!card || e.zone !== zone.id || e.qty <= 0) continue;
      let name = displayName(card);
      // Lists write a legend as "<Champion>, <Legend>"; borrow the champion's first name.
      if (zone.id === "legend" && !card.subtitle) {
        const champ = deck.entries.map((c) => (c.zone === "champion" ? cardById.get(c.cardId) : undefined)).find(Boolean);
        if (champ) name = `${champ.name}, ${name}`;
      }
      counts.set(name, (counts.get(name) ?? 0) + e.qty);
    }
    if (!counts.size) continue;
    const lines = [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([name, qty]) => `${qty} ${name}`);
    blocks.push(`${zone.heading}:\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n") + "\n";
}

const HEADINGS: Record<string, DeckZone> = {
  legend: "legend",
  champion: "champion",
  "chosen champion": "champion",
  main: "main",
  maindeck: "main",
  "main deck": "main",
  deck: "main",
  battlefield: "battlefield",
  battlefields: "battlefield",
  rune: "rune",
  runes: "rune",
  "rune deck": "rune",
  "rune pool": "rune",
  sideboard: "sideboard",
  side: "sideboard",
};

export function parseDeck(text: string, index: DeckIndex): { entries: DeckEntry[]; unknown: string[] } {
  const entries = new Map<string, DeckEntry>();
  const unknown: string[] = [];
  let zone: DeckZone | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    const heading = HEADINGS[line.replace(/[:\-–]+$/, "").trim().toLowerCase()];
    if (heading) {
      zone = heading;
      continue;
    }

    // "3 Name", "3x Name", "Name x3", "Name (OGN-001)" -> qty + name
    let qty = 1;
    let name = line;
    const lead = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    const trail = line.match(/^(.+?)\s+x\s*(\d+)$/i);
    if (lead) {
      qty = Number(lead[1]);
      name = lead[2];
    } else if (trail) {
      qty = Number(trail[2]);
      name = trail[1];
    }
    name = name.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();

    // Legends are named only by their title in the card data ("Agony's Embrace"),
    // while lists write "Evelynn, Agony's Embrace" - so retry without the prefix.
    let key = index.lookup.get(norm(name));
    if (!key && name.includes(",")) {
      const rest = index.lookup.get(norm(name.slice(name.indexOf(",") + 1)));
      if (rest && index.byKey.get(rest)?.[0].types.includes("legend")) key = rest;
    }
    const card = key ? representative(index, key) : undefined;
    if (!card) {
      unknown.push(line);
      continue;
    }
    const z = zone ?? defaultZone(card);
    const id = `${z}:${card.id}`;
    const existing = entries.get(id);
    if (existing) existing.qty += qty;
    else entries.set(id, { cardId: card.id, zone: z, qty });
  }
  const all = [...entries.values()];
  return { entries: all, unknown };
}

// ---------- comparison with the bulk pile ----------

export type CompareRow = {
  key: string;
  card: RiftCard;
  needed: number;
  owned: number; // copies in bulk (any printing)
};

// How many copies of each distinct card the deck needs in total.
export function neededByKey(entries: DeckEntry[], cardById: Map<string, RiftCard>): Map<string, { card: RiftCard; needed: number }> {
  const map = new Map<string, { card: RiftCard; needed: number }>();
  for (const e of entries) {
    const card = cardById.get(e.cardId);
    if (!card || e.qty <= 0) continue;
    const k = cardKey(card);
    const cur = map.get(k);
    if (cur) cur.needed += e.qty;
    else map.set(k, { card, needed: e.qty });
  }
  return map;
}
