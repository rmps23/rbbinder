import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RiftCard, SetInfo } from "@/lib/types";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: cardRows, error: cardsError }, { data: setRows, error: setsError }] = await Promise.all([
      supabase.from("cards").select("payload"),
      supabase.from("sets").select("id, name, card_count"),
    ]);

    if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });
    if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

    const cards: RiftCard[] = (cardRows ?? [])
      .map((r) => r.payload as RiftCard)
      .sort((a, b) => {
        if (a.set.id !== b.set.id) return a.set.id.localeCompare(b.set.id);
        return (a.collectorNumber ?? 0) - (b.collectorNumber ?? 0);
      });

    const sets: SetInfo[] = (setRows ?? [])
      .map((r) => ({ id: r.id, name: r.name, cardCount: r.card_count }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ cards, sets });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}
