import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { fetchRiftboundCatalog } from "@/lib/riftboundCatalog";
import { missingPromos, missingRunes } from "@/lib/extraCards";
import { getExistingCardIds, upsertCardsAndSets } from "@/lib/repo";
import type { CardsSyncResult } from "@/lib/types";

// Card catalog sync can take a few seconds (fetch + parse ~1200 cards, then
// upsert in chunks) - give it more room than the default.
export const maxDuration = 60;

export async function POST() {
  const user = await requireUser({ admin: true });
  if (user instanceof NextResponse) return user;
  try {
    const catalog = await fetchRiftboundCatalog();
    // Rune printings Riot's gallery doesn't list (best effort - never blocks the sync).
    const extra = await missingRunes(catalog.cards, catalog.sets).catch(() => ({ cards: [], sets: [] }));
    // Promo printings (event, judge and bundle promos) - also best effort.
    const promos = await missingPromos([...catalog.cards, ...extra.cards]).catch(() => ({ cards: [], sets: [] }));
    const extraCards = [...extra.cards, ...promos.cards];
    const cards = [...catalog.cards, ...extraCards];
    const extraSets = [...extra.sets];
    for (const s of promos.sets) {
      const cur = extraSets.find((x) => x.id === s.id);
      if (cur) cur.cardCount += s.cardCount;
      else extraSets.push(s);
    }
    const sets = [
      ...catalog.sets.map((s) => ({ ...s, cardCount: s.cardCount + extraCards.filter((c) => c.set.id === s.id).length })),
      ...extraSets.filter((s) => !catalog.sets.some((c) => c.id === s.id)),
    ];
    const existingIds = await getExistingCardIds();
    await upsertCardsAndSets(cards, sets);

    const newCards = cards.filter((c) => !existingIds.has(c.id));
    const newSetIds = [...new Set(newCards.map((c) => c.set.id))];

    const result: CardsSyncResult = {
      ok: true,
      totalCards: cards.length,
      totalSets: sets.length,
      newCards: newCards.length,
      newSets: newSetIds,
    };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync cards" },
      { status: 500 }
    );
  }
}
