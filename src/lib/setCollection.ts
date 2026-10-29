import type { RiftCard } from "./types";

// "Base" cards of a set: one of each regular number, e.g. OGN-001/298 to
// OGN-298/298. Left out: alternate arts (OGN-007a), signatures (*), overnumbered
// cards (OGN-299/298), showcase rarity, promos (SP…), tokens and anything else
// without a plain "SET-n/total" code. Collecting a set = owning one of each.
const BASE_CODE = /^[A-Z0-9]+-(\d+)\/(\d+)$/;

export function isBaseCard(card: RiftCard): boolean {
  const m = card.publicCode.match(BASE_CODE);
  if (!m) return false;
  if (Number(m[1]) > Number(m[2])) return false;
  return card.rarity?.id !== "showcase";
}

export function baseCardsOf(cards: RiftCard[], setId: string): RiftCard[] {
  return cards.filter((c) => c.set.id === setId && isBaseCard(c));
}

// How many of a set's base cards are among `owned` (card ids).
export function setProgress(cards: RiftCard[], setId: string, owned: Set<string> | Iterable<string>) {
  const have = owned instanceof Set ? owned : new Set(owned);
  const base = baseCardsOf(cards, setId);
  const got = base.filter((c) => have.has(c.id)).length;
  return { have: got, total: base.length, pct: base.length ? got / base.length : 0 };
}

export type PrintingKind = "regular" | "alt" | "overnumbered" | "signature" | "showcase" | "promo";

// What kind of printing a card is, for the version picker and for choosing the
// plain version by default.
const RUNE_CODE = /^[A-Z0-9]+-R\d+([a-z]*)$/;

export function printingKind(card: RiftCard): PrintingKind {
  if (card.publicCode.includes("*")) return "signature";
  const rune = card.publicCode.match(RUNE_CODE); // e.g. SFD-R01, SFD-R01a
  if (rune) return rune[1] ? "alt" : "regular";
  if (/-\d+[a-zA-Z]+\//.test(card.publicCode)) return "alt";
  const m = card.publicCode.match(BASE_CODE);
  if (!m) return "promo"; // SP…, OGS starter codes, etc.
  if (Number(m[1]) > Number(m[2])) return "overnumbered";
  if (card.rarity?.id === "showcase") return "showcase";
  return "regular";
}

// A copy you'd actually play: the regular printing (numbered card or plain rune).
export const isRegularPrinting = (card: RiftCard) => printingKind(card) === "regular";

export const PRINTING_LABEL: Record<PrintingKind, string> = {
  regular: "Regular",
  alt: "Alternate art",
  overnumbered: "Overnumbered",
  signature: "Signature",
  showcase: "Showcase",
  promo: "Promo",
};
