import { NextResponse } from "next/server";
import { fetchRiftboundCatalog } from "@/lib/riftboundCatalog";
import { getExistingCardIds, upsertCardsAndSets } from "@/lib/repo";
import type { CardsSyncResult } from "@/lib/types";

// Card catalog sync can take a few seconds (fetch + parse ~1200 cards, then
// upsert in chunks) - give it more room than the default.
export const maxDuration = 60;

export async function POST() {
  try {
    const { cards, sets } = await fetchRiftboundCatalog();
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
      { error: err instanceof Error ? err.message : "Falha ao sincronizar cartas" },
      { status: 500 }
    );
  }
}
