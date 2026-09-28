import { NextResponse } from "next/server";
import { getCardsAndSets } from "@/lib/repo";

export async function GET() {
  try {
    const { cards, sets } = await getCardsAndSets();
    return NextResponse.json({ cards, sets });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load cards" }, { status: 500 });
  }
}
