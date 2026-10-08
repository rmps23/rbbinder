import { isAlternateArt } from "./cardUtils";
import type { BinderSlots, RiftCard } from "./types";

export type ScanMatch = {
  via: "code" | "name";
  // Set code AND number/total were all read and agree with the catalog.
  strong?: boolean;
  // Best guess first; the rest are other prints the user can switch to.
  candidates: RiftCard[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// OCR tends to confuse look-alike glyphs when it's reading digits.
const fixDigits = (s: string) =>
  s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/B/g, "8");

// "OGN-042/298" -> { number: 42, total: 298 }
function parsePublicCode(code: string): { number: number; total: number } | null {
  const m = code.match(/-(\d+)[a-zA-Z*]*\/(\d+)/);
  return m ? { number: Number(m[1]), total: Number(m[2]) } : null;
}

const rankBase = (a: RiftCard, b: RiftCard) => Number(isAlternateArt(a) || a.publicCode.includes("*")) - Number(isAlternateArt(b) || b.publicCode.includes("*"));

export function matchScan(text: string, cards: RiftCard[]): ScanMatch | null {
  // 1) Collector number: "042/298", optionally preceded by the set code.
  const re = /([A-Za-z]{3})?\W{0,3}([0-9OoIl|SB]{1,3})\s*([a-z*])?\s*\/\s*([0-9OoIl|SB]{2,3})/g;
  for (const m of text.matchAll(re)) {
    const number = Number(fixDigits(m[2]));
    const total = Number(fixDigits(m[4]));
    if (!number || !total || number > total + 120) continue;
    const setCode = m[1]?.toUpperCase();

    let found = cards.filter((c) => {
      const p = parsePublicCode(c.publicCode);
      return p && p.number === number && p.total === total;
    });
    const strong = !!setCode && found.some((c) => c.set.id === setCode);
    if (strong) found = found.filter((c) => c.set.id === setCode);
    if (!found.length) continue;
    return { via: "code", strong, candidates: [...found].sort(rankBase) };
  }

  // 2) Fallback: a card name that appears in the text (longest wins).
  const haystack = ` ${norm(text)} `;
  let best: { len: number; name: string } | null = null;
  const seen = new Set<string>();
  for (const c of cards) {
    const names = [c.name, c.subtitle ? `${c.name} ${c.subtitle}` : null].filter((n): n is string => !!n);
    for (const n of names) {
      const key = norm(n);
      if (key.length < 5 || seen.has(key)) continue;
      seen.add(key);
      if (haystack.includes(` ${key} `) && (!best || key.length > best.len)) best = { len: key.length, name: key };
    }
  }
  if (!best) return null;
  const found = cards.filter((c) => norm(c.name) === best!.name || norm(`${c.name} ${c.subtitle ?? ""}`) === best!.name);
  return found.length ? { via: "name", candidates: [...found].sort(rankBase) } : null;
}

// Binders are laid out in collector-number order (slot = number - 1), so a
// scanned card goes to its own slot; if a different card already sits there
// it takes the next free slot after it.
export function targetPosition(card: RiftCard, slots: BinderSlots): { position: number; bump: boolean } {
  const base = Math.max(0, card.collectorNumber - 1);
  let position = base;
  while (slots[position] && slots[position].qty > 0 && slots[position].cardId !== card.id) position++;
  return { position, bump: position !== base };
}
