import { NextRequest, NextResponse } from "next/server";
import { legendOptions, recommendDeck, type Style } from "@/lib/deckAdvisor";

// The model needs a while to think through a few hundred cards.
export const maxDuration = 60;

const STYLES: Style[] = ["any", "aggro", "midrange", "control"];

// Legends in your bulk and how buildable each one is.
export async function GET() {
  try {
    return NextResponse.json(await legendOptions());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const rec = await recommendDeck({
      legendId: typeof body.legendId === "string" ? body.legendId : undefined,
      style: STYLES.includes(body.style) ? body.style : "any",
      note: typeof body.note === "string" ? body.note : "",
    });
    return NextResponse.json(rec);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't build a deck" }, { status: 500 });
  }
}
