import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchRiftboundCatalog } from "@/lib/riftboundCatalog";
import type { CardsSyncResult } from "@/lib/types";

// Card catalog sync can take a few seconds (fetch + parse ~1200 cards, then
// upsert into Supabase in chunks) - give it more room than the default.
export const maxDuration = 60;

const CHUNK_SIZE = 200;

export async function POST() {
  try {
    const { cards, sets } = await fetchRiftboundCatalog();
    const supabase = getSupabaseAdmin();

    const { data: existingRows, error: existingError } = await supabase.from("cards").select("id");
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    const existingIds = new Set((existingRows ?? []).map((r) => r.id));

    const now = new Date().toISOString();

    for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
      const chunk = cards.slice(i, i + CHUNK_SIZE).map((c) => ({
        id: c.id,
        set_id: c.set.id,
        payload: c,
        updated_at: now,
      }));
      const { error } = await supabase.from("cards").upsert(chunk, { onConflict: "id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: setsError } = await supabase.from("sets").upsert(
      sets.map((s) => ({ id: s.id, name: s.name, card_count: s.cardCount, updated_at: now })),
      { onConflict: "id" }
    );
    if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

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
