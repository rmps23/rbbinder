import { cardKey, displayName } from "./deck";
import type { DeckEntry, DeckZone, RiftCard } from "./types";

// Riftbound Core Rules, section 103 (Deckbuilding), and the Constructed
// sideboard rules from the Tournament Rules (Oct 2026).
export const LIMITS = {
  main: 40, // at least; includes the Chosen Champion (103.3)
  runes: 12, // exactly (103.4.a)
  battlefields: 3, // set by the mode of play - 3 for standard Constructed (103.5)
  sideboard: 10, // up to, Constructed
  copies: 3, // per name, main deck + champion + sideboard together (103.3.b)
  signatures: 3, // in total, all with the legend's champion tag (103.3.d)
};

const hasSuper = (c: RiftCard, s: string) => c.superTypes?.includes(s) ?? false;
// Cards synced before supertypes were stored have none; then any unit may be offered.
export const isChampionUnit = (c: RiftCard) =>
  c.types.includes("unit") && (c.superTypes === undefined || hasSuper(c, "champion"));
export const isSignature = (c: RiftCard) => hasSuper(c, "signature");
export const isToken = (c: RiftCard) => hasSuper(c, "token");

// Do we know card supertypes (cards synced before they were stored don't)?
export const hasRuleData = (cards: RiftCard[]) => cards.some((c) => c.superTypes && c.superTypes.length > 0);

// A legend dictates the deck's Domain Identity (103.2.b).
export function identityOf(legend: RiftCard | undefined): Set<string> | null {
  return legend ? new Set(legend.domains.map((d) => d.id).filter((d) => d !== "colorless")) : null;
}

// Single-domain card: its domain is in the identity. Multi-domain: all of them
// are. No domain: always fine (103.2.b.3-5).
export function fitsIdentity(card: RiftCard, identity: Set<string> | null): boolean {
  if (!identity) return true;
  return card.domains.every((d) => d.id === "colorless" || identity.has(d.id));
}

function legendTags(legend: RiftCard | undefined): string[] {
  return (legend?.tags ?? []).map((t) => t.toLowerCase());
}
export function matchesLegendTag(card: RiftCard, legend: RiftCard | undefined): boolean {
  const lt = legendTags(legend);
  if (!lt.length) return true; // no data to judge by
  return card.tags.some((t) => lt.includes(t.toLowerCase()));
}

type Ctx = { entries: DeckEntry[]; cardById: Map<string, RiftCard> };

function summary({ entries, cardById }: Ctx) {
  const legend = entries.filter((e) => e.zone === "legend").map((e) => cardById.get(e.cardId))[0];
  const copies = new Map<string, number>();
  const zoneCount: Record<DeckZone, number> = { legend: 0, champion: 0, main: 0, battlefield: 0, rune: 0, sideboard: 0 };
  const battlefieldNames = new Map<string, number>();
  let signatures = 0;
  for (const e of entries) {
    const card = cardById.get(e.cardId);
    if (!card) continue;
    zoneCount[e.zone] += e.qty;
    if (e.zone === "main" || e.zone === "champion" || e.zone === "sideboard") {
      copies.set(cardKey(card), (copies.get(cardKey(card)) ?? 0) + e.qty);
      if (isSignature(card)) signatures += e.qty;
    }
    if (e.zone === "battlefield") battlefieldNames.set(cardKey(card), (battlefieldNames.get(cardKey(card)) ?? 0) + e.qty);
  }
  return { legend, copies, zoneCount, battlefieldNames, signatures };
}

// Which cards belong in a zone's pool at all (ignores how many are already in).
export function belongsInPool(card: RiftCard, zone: DeckZone, legend: RiftCard | undefined): boolean {
  const identity = identityOf(legend);
  switch (zone) {
    case "legend":
      return card.types.includes("legend");
    case "champion":
      return isChampionUnit(card) && !isToken(card) && fitsIdentity(card, identity) && matchesLegendTag(card, legend);
    case "main":
    case "sideboard":
      return (
        card.types.some((t) => t === "unit" || t === "spell" || t === "gear") &&
        !isToken(card) &&
        fitsIdentity(card, identity) &&
        (!isSignature(card) || matchesLegendTag(card, legend))
      );
    case "battlefield":
      return card.types.includes("battlefield") && !isToken(card) && fitsIdentity(card, identity);
    case "rune":
      return card.types.includes("rune") && fitsIdentity(card, identity);
  }
}

// null when the card can go in; otherwise why not.
export function whyNot(card: RiftCard, zone: DeckZone, ctx: Ctx): string | null {
  const s = summary(ctx);
  const name = displayName(card);
  if (zone !== "legend" && zone !== "battlefield" && !s.legend) return "Pick a legend first.";
  if (!belongsInPool(card, zone, s.legend)) {
    if (isToken(card)) return `${name} is a token - it can't go in a deck.`;
    if (!fitsIdentity(card, identityOf(s.legend))) return `${name} is outside your legend's domains.`;
    if (zone === "champion") return `${name} isn't a champion for ${s.legend ? displayName(s.legend) : "this legend"}.`;
    if (isSignature(card)) return `${name} is a signature card for another champion.`;
    return `${name} can't go in ${zone}.`;
  }
  if (zone === "legend" || zone === "champion") return null; // replaces the current one
  if (zone === "rune") return s.zoneCount.rune >= LIMITS.runes ? "The rune deck is full (12)." : null;
  if (zone === "battlefield") {
    if (s.zoneCount.battlefield >= LIMITS.battlefields) return "You already have 3 battlefields.";
    if (s.battlefieldNames.has(cardKey(card))) return "Only one battlefield of the same name.";
    return null;
  }
  if (zone === "sideboard" && s.zoneCount.sideboard >= LIMITS.sideboard) return "The sideboard is full (10).";
  if ((s.copies.get(cardKey(card)) ?? 0) >= LIMITS.copies) return `Max ${LIMITS.copies} copies of ${name} (main deck and sideboard together).`;
  if (isSignature(card) && s.signatures >= LIMITS.signatures) return "A deck can have 3 signature cards in total.";
  return null;
}

export type Check = { id: string; label: string; detail: string; ok: boolean };

// The checklist shown in the builder; every item is a rule from the Core Rules.
export function checkDeck(ctx: Ctx): { checks: Check[]; problems: string[]; legal: boolean } {
  const s = summary(ctx);
  const { cardById, entries } = ctx;
  const identity = identityOf(s.legend);
  const problems: string[] = [];
  const checks: Check[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, ok, detail });

  add("legend", "1 legend", s.zoneCount.legend === 1, `${s.zoneCount.legend}/1`);

  const champ = entries.filter((e) => e.zone === "champion").map((e) => cardById.get(e.cardId))[0];
  const champOk =
    s.zoneCount.champion === 1 && !!champ && isChampionUnit(champ) && matchesLegendTag(champ, s.legend);
  add("champion", "1 chosen champion matching the legend", champOk, `${s.zoneCount.champion}/1`);

  const main = s.zoneCount.main + s.zoneCount.champion;
  add("main", "Main deck of at least 40 (champion included)", main >= LIMITS.main, `${main}/${LIMITS.main}`);
  add("runes", "Exactly 12 runes", s.zoneCount.rune === LIMITS.runes, `${s.zoneCount.rune}/${LIMITS.runes}`);
  add("bf", "3 battlefields", s.zoneCount.battlefield === LIMITS.battlefields, `${s.zoneCount.battlefield}/${LIMITS.battlefields}`);

  const overCopies = [...s.copies].filter(([, q]) => q > LIMITS.copies);
  for (const [key, q] of overCopies) {
    const card = entries.map((e) => cardById.get(e.cardId)).find((c) => c && cardKey(c) === key);
    if (card) problems.push(`${displayName(card)}: ${q} copies (max 3)`);
  }
  add("copies", "Max 3 copies per card name", overCopies.length === 0, overCopies.length ? `${overCopies.length} over` : "ok");

  const dupBf = [...s.battlefieldNames].filter(([, q]) => q > 1);
  if (dupBf.length) problems.push("Battlefields must all have different names");
  add("bfnames", "Battlefields all different", dupBf.length === 0, dupBf.length ? "duplicates" : "ok");

  const sigs = entries.filter((e) => e.zone !== "legend" && cardById.get(e.cardId) && isSignature(cardById.get(e.cardId)!));
  const sigBad = sigs.filter((e) => !matchesLegendTag(cardById.get(e.cardId)!, s.legend));
  add("sig", "Max 3 signature cards, all your champion's", s.signatures <= LIMITS.signatures && sigBad.length === 0, `${s.signatures}/${LIMITS.signatures}`);
  for (const e of sigBad) problems.push(`${displayName(cardById.get(e.cardId)!)} is another champion's signature card`);

  const outside = entries.filter((e) => e.zone !== "legend" && cardById.get(e.cardId) && !fitsIdentity(cardById.get(e.cardId)!, identity));
  for (const e of outside) problems.push(`${displayName(cardById.get(e.cardId)!)} is outside your legend's domains`);
  add("identity", "Everything within the legend's domains", outside.length === 0, outside.length ? `${outside.length} outside` : "ok");

  const side = s.zoneCount.sideboard;
  const sideBad = entries.filter((e) => {
    const card = cardById.get(e.cardId);
    return e.zone === "sideboard" && !!card && !belongsInPool(card, "sideboard", s.legend);
  });
  add("side", "Sideboard up to 10 cards", side <= LIMITS.sideboard && sideBad.length === 0, `${side}/${LIMITS.sideboard}`);

  const tokens = entries.filter((e) => cardById.get(e.cardId) && isToken(cardById.get(e.cardId)!));
  if (tokens.length) problems.push("Tokens can't be in a deck");

  return { checks, problems, legal: checks.every((c) => c.ok) && tokens.length === 0 };
}
