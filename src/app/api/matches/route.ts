import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { addMatches, listDecks, listMatches } from "@/lib/repo";
import { cleanSummary } from "@/lib/matchInput";
import type { MatchSummary } from "@/lib/types";

const MAX_PER_REQUEST = 50;

function fail(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const hint = /matches/i.test(message) && /(relation|schema cache|does not exist|find the table)/i.test(message)
    ? "The matches table doesn't exist yet - run supabase/migrations/003_matches.sql in the Supabase SQL editor."
    : message;
  return NextResponse.json({ error: hint }, { status: 500 });
}

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(await listMatches(user.id));
  } catch (err) {
    return fail(err, "Failed to load matches");
  }
}

// Body: { items: [{ summary, deckId }] } - the summaries the browser read from the replays.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.items) ? body.items : [];
  if (!raw.length || raw.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_PER_REQUEST} games` }, { status: 400 });
  }
  try {
    const myDecks = new Set((await listDecks(user.id)).map((d) => d.id));
    const items: { summary: MatchSummary; deckId: string | null }[] = [];
    for (const r of raw) {
      const item = r as { summary?: unknown; deckId?: unknown } | null;
      const summary = cleanSummary(item?.summary);
      if (!summary) return NextResponse.json({ error: "One of the games isn't valid" }, { status: 400 });
      const deckId = typeof item?.deckId === "string" && myDecks.has(item.deckId) ? item.deckId : null;
      items.push({ summary, deckId });
    }
    const added = await addMatches(user.id, items);
    return NextResponse.json({ added, skipped: items.length - added }, { status: 201 });
  } catch (err) {
    return fail(err, "Failed to save the matches");
  }
}
