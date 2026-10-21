import { NextResponse } from "next/server";
import { getFinishData } from "@/lib/overrides";
import { getCardsAndSets } from "@/lib/repo";

export async function GET() {
  try {
    const [{ cards, sets }, finishes] = await Promise.all([getCardsAndSets(), getFinishData()]);
    return NextResponse.json({ cards, sets, finishes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load cards" }, { status: 500 });
  }
}
