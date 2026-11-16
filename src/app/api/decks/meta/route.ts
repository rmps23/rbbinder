import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { metaOptions } from "@/lib/metaCheck";

// Reading Riot's articles the first time takes a few seconds.
export const maxDuration = 60;

// Decks from Riot's official "Top Decks" articles, with how much of each you own.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(await metaOptions(user.id, req.nextUrl.searchParams.get("refresh") === "1"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load the meta decks" }, { status: 500 });
  }
}
