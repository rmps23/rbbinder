import type { DeckEntry, RiftCard } from "./types";

export type StatRow = { entry: DeckEntry; card: RiftCard };

const KINDS = ["unit", "spell", "gear"] as const;
export type Kind = (typeof KINDS)[number];

const kindOf = (c: RiftCard): Kind | null => KINDS.find((k) => c.types.includes(k)) ?? null;

export type DeckStatsData = {
  total: number; // main + champion (the 40)
  curve: number[]; // 8 bins (0..7+), copies
  curveByKind: Record<Kind, number[]>;
  mightCurve: number[]; // units only, 8 bins
  avgEnergy: number | null;
  avgPower: number | null;
  avgMight: number | null;
  kinds: Record<Kind, number>;
  domains: Map<string, number>; // copies per domain (multi-domain cards count in each)
  rarities: Map<string, number>;
  keywords: Map<string, number>;
  cheap: number; // energy <= 2
  mid: number; // 3-4
  top: number; // 5+
  powerByDomain: Map<string, { pips: number; cards: number; runes: number }>;
  runeTotal: number;
  battlefields: number;
};

const bin = (n: number) => Math.min(7, Math.max(0, n));

export function computeStats(rows: StatRow[]): DeckStatsData {
  const playable = rows.filter((r) => r.entry.zone === "main" || r.entry.zone === "champion");
  const curve = Array<number>(8).fill(0);
  const curveByKind: Record<Kind, number[]> = { unit: Array(8).fill(0), spell: Array(8).fill(0), gear: Array(8).fill(0) };
  const mightCurve = Array<number>(8).fill(0);
  const kinds: Record<Kind, number> = { unit: 0, spell: 0, gear: 0 };
  const domains = new Map<string, number>();
  const rarities = new Map<string, number>();
  const keywords = new Map<string, number>();
  const powerByDomain = new Map<string, { pips: number; cards: number; runes: number }>();
  const dom = (d: string) => powerByDomain.get(d) ?? powerByDomain.set(d, { pips: 0, cards: 0, runes: 0 }).get(d)!;

  let total = 0;
  let eSum = 0;
  let eN = 0;
  let pSum = 0;
  let pN = 0;
  let mSum = 0;
  let mN = 0;
  let cheap = 0;
  let mid = 0;
  let top = 0;

  for (const { entry, card } of playable) {
    const q = entry.qty;
    total += q;
    const kind = kindOf(card);
    if (kind) kinds[kind] += q;
    for (const d of card.domains) if (d.id !== "colorless") domains.set(d.id, (domains.get(d.id) ?? 0) + q);
    if (card.rarity) rarities.set(card.rarity.id, (rarities.get(card.rarity.id) ?? 0) + q);

    if (card.energy !== null) {
      const b = bin(card.energy);
      curve[b] += q;
      if (kind) curveByKind[kind][b] += q;
      eSum += card.energy * q;
      eN += q;
      if (card.energy <= 2) cheap += q;
      else if (card.energy <= 4) mid += q;
      else top += q;
    }
    if (card.power !== null && card.power > 0) {
      pSum += card.power * q;
      pN += q;
      for (const d of card.domains) {
        if (d.id === "colorless") continue;
        const p = dom(d.id);
        p.pips += card.power * q;
        p.cards += q;
      }
    }
    if (kind === "unit" && card.might !== null) {
      const m = card.might + (card.mightBonus ?? 0);
      mightCurve[bin(m)] += q;
      mSum += m * q;
      mN += q;
    }
    for (const m of (card.abilityText ?? "").matchAll(/\[([A-Za-z][A-Za-z ]*?)(?: \d+)?\]/g)) {
      const k = m[1].trim();
      if (k) keywords.set(k, (keywords.get(k) ?? 0) + q);
    }
  }

  let runeTotal = 0;
  let battlefields = 0;
  for (const { entry, card } of rows) {
    if (entry.zone === "rune") {
      runeTotal += entry.qty;
      for (const d of card.domains) if (d.id !== "colorless") dom(d.id).runes += entry.qty;
    }
    if (entry.zone === "battlefield") battlefields += entry.qty;
  }

  return {
    total,
    curve,
    curveByKind,
    mightCurve,
    avgEnergy: eN ? eSum / eN : null,
    avgPower: pN ? pSum / pN : null,
    avgMight: mN ? mSum / mN : null,
    kinds,
    domains,
    rarities,
    keywords,
    cheap,
    mid,
    top,
    powerByDomain,
    runeTotal,
    battlefields,
  };
}

// ---- rough deck score ----------------------------------------------------------------------------------------
// Heuristics for a quick read, not a verdict: they compare the deck against common deck-building rules of thumb.

export type Score = { id: string; label: string; value: number; hint: string };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreDeck(s: DeckStatsData): { scores: Score[]; overall: number; grade: "S" | "A" | "B" | "C" | "D" } {
  // Curve: average energy near 3 and most cards cheap enough to play early.
  const lowShare = s.total ? (s.curve[0] + s.curve[1] + s.curve[2] + s.curve[3]) / s.total : 0;
  let curve = s.avgEnergy === null ? 0 : 100 - Math.abs(s.avgEnergy - 3) * 28;
  if (lowShare < 0.55) curve -= (0.55 - lowShare) * 120;

  // Mana base: how closely the runes follow the power each domain asks for.
  const pips = [...s.powerByDomain.values()].reduce((n, d) => n + d.pips, 0);
  const runes = [...s.powerByDomain.values()].reduce((n, d) => n + d.runes, 0);
  let mana = 100;
  if (pips > 0 && runes > 0) {
    let dist = 0;
    for (const d of s.powerByDomain.values()) dist += Math.abs(d.pips / pips - d.runes / runes);
    mana = 100 * (1 - dist / 2);
  } else if (pips > 0) mana = 0;
  if (s.runeTotal !== 12) mana -= 15;

  // Balance: a healthy share of units, with some spells/gear around them.
  const unitShare = s.total ? s.kinds.unit / s.total : 0;
  let balance = 100 - Math.max(0, Math.abs(unitShare - 0.5) - 0.15) * 260;
  if (s.total && s.kinds.spell + s.kinds.gear === 0) balance -= 25;

  // Completeness: the 40 cards are all there.
  const complete = (Math.min(s.total, 40) / 40) * 100;

  const scores: Score[] = [
    { id: "curve", label: "Curve", value: clamp(curve), hint: "Average energy near 3, with most cards costing 3 or less." },
    { id: "mana", label: "Mana base", value: clamp(mana), hint: "Your runes follow the power each domain asks for; exactly 12 runes." },
    { id: "balance", label: "Balance", value: clamp(balance), hint: "Around half units, with some spells or gear." },
    { id: "complete", label: "Complete", value: clamp(complete), hint: "How much of the 40 cards is in the deck." },
  ];
  const overall = clamp(scores[0].value * 0.3 + scores[1].value * 0.3 + scores[2].value * 0.2 + scores[3].value * 0.2);
  const grade = overall >= 92 ? "S" : overall >= 82 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : "D";
  return { scores, overall, grade };
}
