import type { RiftCard } from "./types";

// Searching a card by any word on it: name, ability text, tags, types, domains,
// rarity, set and collector code. Keywords like [Hidden] or [Ambush] are read from
// the ability text so they can be used as filters.

// Bracketed words that are not keywords a player would filter by.
const NOT_KEYWORDS = new Set(["add", "no text", "level"]);
const KEYWORD = /\[([A-Za-z][A-Za-z\- ]*?)(?: [\d+]+)?\]/g;

export type CardSearchInfo = { hay: string; keywords: Set<string> };

export function keywordsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(KEYWORD)) {
    const k = m[1].trim();
    if (!NOT_KEYWORDS.has(k.toLowerCase())) out.add(k.charAt(0).toUpperCase() + k.slice(1).toLowerCase());
  }
  return out;
}

// Everything searchable about a card (all its printings), lowercased, in one string.
export function searchInfo(printings: RiftCard[]): CardSearchInfo {
  const rep = printings[0];
  const text = (rep.abilityText ?? "").replace(/:rb_[a-z0-9_]+:/gi, " ").replace(/[[\]]/g, " ");
  const parts = [
    rep.name,
    rep.subtitle ?? "",
    text,
    rep.tags.join(" "),
    rep.types.join(" "),
    (rep.superTypes ?? []).join(" "),
    rep.domains.map((d) => d.label).join(" "),
    rep.rarity?.label ?? "",
    ...printings.flatMap((c) => [c.publicCode, c.set.name]),
  ];
  return { hay: parts.join(" ").replace(/\s+/g, " ").toLowerCase(), keywords: keywordsOf(rep.abilityText ?? "") };
}

// Every word you type has to appear somewhere on the card, in any order.
export function matchesSearch(info: CardSearchInfo, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => info.hay.includes(w));
}
