import { NextResponse } from "next/server";
import { getPrices } from "@/lib/tcgPrices";

export async function GET() {
  try {
    return NextResponse.json(await getPrices(), { headers: { "cache-control": "private, max-age=900" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load prices" }, { status: 502 });
  }
}
